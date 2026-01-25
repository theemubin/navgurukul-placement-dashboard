const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Job = require('../models/Job');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const Skill = require('../models/Skill');
const InterestRequest = require('../models/InterestRequest');
const Application = require('../models/Application');
const { auth, authorize } = require('../middleware/auth');
const AIService = require('../services/aiService');
const { calculateMatch, getJobsWithMatch } = require('../services/matchService');
const discordService = require('../services/discordService');
const multer = require('multer');

// Get unique companies for autocomplete
router.get('/companies', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const companies = await Job.aggregate([
      {
        $group: {
          _id: "$company.name",
          name: { $first: "$company.name" },
          website: { $first: "$company.website" },
          description: { $first: "$company.description" },
          logo: { $first: "$company.logo" }
        }
      },
      { $sort: { name: 1 } }
    ]);
    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching companies' });
  }
});

// Get unique locations for autocomplete
router.get('/locations', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const locations = await Job.distinct('location');
    res.json(locations.filter(l => l).sort());
  } catch (error) {
    res.status(500).json({ message: 'Error fetching locations' });
  }
});

// Configure multer for PDF uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Parse JD with AI (PDF or URL)
router.post('/parse-jd', auth, authorize('coordinator', 'manager'), upload.single('pdf'), async (req, res) => {
  try {
    const { url } = req.body;
    const pdfFile = req.file;

    if (!url && !pdfFile) {
      return res.status(400).json({ message: 'Please provide either a PDF file or a URL' });
    }

    // Get AI config from settings (global keys)
    const settings = await Settings.getSettings();
    const globalKeys = (settings.aiConfig?.googleApiKeys || [])
      .filter(k => k.isActive)
      .map(k => k.key);

    // Get user's personal AI keys (for coordinators)
    const user = await User.findById(req.userId);
    const userKeys = (user?.aiApiKeys || [])
      .filter(k => k.isActive)
      .map(k => k.key);

    // Combine all keys: user keys first (higher priority), then global keys
    const allKeys = [...userKeys, ...globalKeys].filter(k => k);

    // Get existing skills for better matching
    let existingSkills = [];
    let skillNames = [];
    try {
      existingSkills = await Skill.find({ isActive: true }).select('name');
      skillNames = existingSkills.map(s => s.name);
    } catch (skillError) {
      console.warn('Could not fetch skills:', skillError.message);
    }

    const aiService = new AIService(allKeys);
    let text = '';

    // Extract text from PDF or URL
    try {
      if (pdfFile) {
        text = await aiService.extractTextFromPDF(pdfFile.buffer);
      } else if (url) {
        text = await aiService.extractTextFromURL(url);
      }
    } catch (extractError) {
      return res.status(400).json({
        message: extractError.message || 'Failed to extract content from the provided source.',
        success: false
      });
    }

    if (!text || text.length < 50) {
      return res.status(400).json({
        message: 'Could not extract enough text from the provided source. Please try a different file or URL.'
      });
    }

    let parsedData;

    // Step 1: Try code-based extraction first (conserves AI quota)
    console.log('Attempting code-based JD parsing...');
    parsedData = await aiService.parseJobDescriptionWithCode(text);
    let parsedWith = 'code';

    // Step 2: If code-based gave minimal results and AI is available, try AI
    if (allKeys.length > 0 && settings.aiConfig?.enabled !== false &&
      (!parsedData || !parsedData.title || parsedData.suggestedSkills.length < 3)) {
      console.log('Code extraction had limited results, attempting AI parsing...');
      try {
        const aiResult = await aiService.parseJobDescription(text, skillNames);
        // Merge AI results into code results, AI fills gaps
        parsedData = {
          ...parsedData,
          ...aiResult,
          suggestedSkills: [...new Set([...(parsedData?.suggestedSkills || []), ...aiResult.suggestedSkills])],
          requirements: aiResult.requirements.length > (parsedData?.requirements.length || 0) ? aiResult.requirements : parsedData?.requirements
        };
        parsedWith = 'ai';
      } catch (aiError) {
        console.error('AI parsing failed, continuing with code extraction:', aiError.message);
        // Keep code-based results
        parsedData.aiError = aiError.message || 'AI parse failed';
        parsedData.aiErrorCode = aiError.code || aiError.originalError?.code || null;
      }
    }

    if (!parsedData) {
      // Final fallback to regex extraction
      parsedData = aiService.parseJobDescriptionFallback(text);
      parsedWith = 'fallback';
    }

    parsedData.parsedWith = parsedWith;

    // Match suggested skills with existing skills in database
    if (parsedData.suggestedSkills?.length > 0 && existingSkills.length > 0) {
      const matchedSkills = existingSkills.filter(skill =>
        parsedData.suggestedSkills.some(suggested =>
          skill.name.toLowerCase().includes(suggested.toLowerCase()) ||
          suggested.toLowerCase().includes(skill.name.toLowerCase())
        )
      );
      parsedData.matchedSkillIds = matchedSkills.map(s => s._id);
    }

    // Ask AI service for a more precise status
    let aiStatus = {
      configured: allKeys.length > 0,
      enabled: settings.aiConfig?.enabled !== false,
      working: false,
      totalKeys: allKeys.length,
      userKeys: userKeys.length,
      globalKeys: globalKeys.length
    };
    try {
      const svcStatus = await aiService.getStatus();
      aiStatus = { ...aiStatus, ...svcStatus };
      if (parsedData.aiError) {
        aiStatus.working = false;
        aiStatus.message = parsedData.aiError;
      }
    } catch (statusErr) {
      aiStatus.working = false;
      aiStatus.message = statusErr.message;
    }

    const responseMessage = parsedData.parsedWith === 'ai'
      ? 'Job description parsed successfully with AI'
      : (aiStatus.configured ? 'AI parsing attempted but failed; falling back to basic extraction.' : 'Parsed with basic extraction. Add Google AI API key in Settings for better results.');

    res.json({
      success: true,
      data: parsedData,
      message: responseMessage,
      aiStatus,
      aiError: parsedData.aiError || null,
      aiErrorCode: parsedData.aiErrorCode || null
    });

  } catch (error) {
    console.error('Parse JD error:', error);
    res.status(500).json({
      message: error.message || 'Failed to parse job description',
      success: false
    });
  }
});

// Get all jobs (filtered by role and eligibility)
router.get('/', auth, async (req, res) => {
  try {
    const {
      status, company, jobType, campus, search,
      roleCategory,
      page = 1, limit = 20
    } = req.query;

    let query = {};

    // Students only see jobs in student-visible pipeline stages
    if (req.user.role === 'student') {
      // Get pipeline settings to check which stages are visible to students
      const settings = await Settings.getSettings();
      const visibleStages = settings.jobPipelineStages
        .filter(stage => stage.visibleToStudents)
        .map(stage => stage.id);

      // Include legacy 'active' status for backward compatibility
      const studentVisibleStatuses = [...visibleStages, 'active'];

      query.status = { $in: studentVisibleStatuses };
      query.applicationDeadline = { $gte: new Date() };

      // Build eligibility filters
      const campusFilter = req.user.campus ? {
        $or: [
          { 'eligibility.campuses': { $size: 0 } },
          { 'eligibility.campuses': req.user.campus }
        ]
      } : null;

      const studentHouse = req.user.studentProfile?.houseName;
      const houseFilter = {
        $or: [
          { 'eligibility.houses': { $size: 0 } },
          ...(studentHouse ? [{ 'eligibility.houses': studentHouse }] : [])
        ]
      };

      // Combine eligibility filters
      if (campusFilter) {
        query.$and = [campusFilter, houseFilter];
      } else {
        query.$or = houseFilter.$or;
      }
    } else {
      if (status) query.status = status;
    }

    if (company) {
      query['company.name'] = { $regex: company, $options: 'i' };
    }

    if (jobType) {
      // Support comma-separated job types (e.g., "full_time,part_time,contract")
      const jobTypes = jobType.split(',').map(t => t.trim());
      if (jobTypes.length > 1) {
        query.jobType = { $in: jobTypes };
      } else {
        query.jobType = jobType;
      }
    }

    if (campus) {
      query['eligibility.campuses'] = campus;
    }

    // If requested, return only jobs where current user is the coordinator (My Leads)
    if (req.query.myLeads === 'true' && req.user) {
      query.coordinator = req.userId;
    }

    // If requested, filter jobs by a specific coordinator id (coordinator filter in UI)
    if (req.query.coordinator) {
      query.coordinator = req.query.coordinator;
    }

    if (roleCategory) {
      query.roleCategory = roleCategory;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const jobs = await Job.find(query)
      .populate('requiredSkills.skill')
      .populate('eligibility.campuses', 'name')
      .populate('createdBy', 'firstName lastName')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Job.countDocuments(query);

    // Aggregate application status counts for the returned jobs (shortlisted, applied, etc.)
    const jobIds = jobs.map(j => j._id);
    let statusMap = {};
    if (jobIds.length > 0) {
      const agg = await Application.aggregate([
        { $match: { job: { $in: jobIds } } },
        { $group: { _id: { job: '$job', status: '$status' }, count: { $sum: 1 } } }
      ]);

      agg.forEach(a => {
        const jobId = a._id.job.toString();
        statusMap[jobId] = statusMap[jobId] || {};
        statusMap[jobId][a._id.status] = a.count;
      });
    }

    const jobsWithCounts = jobs.map(j => {
      const jobObj = j.toObject ? j.toObject() : j;
      jobObj.statusCounts = Object.assign({
        applied: 0,
        shortlisted: 0,
        in_progress: 0,
        selected: 0,
        rejected: 0,
        withdrawn: 0,
        interested: 0
      }, statusMap[j._id.toString()] || {});

      // totalApplications: sum of all status counts (exclude withdrawn if you prefer)
      jobObj.totalApplications = Object.values(jobObj.statusCounts || {}).reduce((a, b) => a + (b || 0), 0);

      return jobObj;
    });

    res.json({
      jobs: jobsWithCounts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get matching jobs for student with detailed match calculation
router.get('/matching', auth, authorize('student'), async (req, res) => {
  try {
    const student = await User.findById(req.userId)
      .populate('studentProfile.skills.skill')
      .populate('campus');

    // Get pipeline settings to determine which jobs are visible to students
    const settings = await Settings.getSettings();
    const visibleStages = settings.jobPipelineStages
      .filter(stage => stage.visibleToStudents)
      .map(stage => stage.id);

    // Include legacy 'active' status for backward compatibility
    const studentVisibleStatuses = [...visibleStages, 'active'];

    // Get all jobs visible to students that meet basic criteria
    const jobs = await Job.find({
      status: { $in: studentVisibleStatuses },
      applicationDeadline: { $gte: new Date() },
      $or: [
        { 'eligibility.campuses': { $size: 0 } },
        { 'eligibility.campuses': student.campus?._id }
      ]
    })
      .populate('requiredSkills.skill')
      .populate('eligibility.campuses', 'name')
      .sort({ createdAt: -1 });

    // Calculate detailed match for each job
    const jobsWithMatch = jobs.map(job => {
      const matchDetails = calculateMatch(student, job);
      return {
        ...job.toObject(),
        matchDetails
      };
    });

    // Sort by match percentage (highest first)
    jobsWithMatch.sort((a, b) => b.matchDetails.overallPercentage - a.matchDetails.overallPercentage);

    res.json(jobsWithMatch);
  } catch (error) {
    console.error('Get matching jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single job with match details for student
router.get('/:id/match', auth, authorize('student'), async (req, res) => {
  try {
    const student = await User.findById(req.userId)
      .populate('studentProfile.skills.skill')
      .populate('campus');

    const job = await Job.findById(req.params.id)
      .populate('requiredSkills.skill')
      .populate('eligibility.campuses', 'name code')
      .populate('createdBy', 'firstName lastName email')
      .populate('coordinator', 'firstName lastName email')
      .populate('timeline.changedBy', 'firstName lastName');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const matchDetails = calculateMatch(student, job);

    // Check if student has an existing interest request
    const existingInterest = await InterestRequest.findOne({
      student: req.userId,
      job: req.params.id
    });

    res.json({
      ...job.toObject(),
      matchDetails,
      interestRequest: existingInterest ? {
        status: existingInterest.status,
        createdAt: existingInterest.createdAt
      } : null
    });
  } catch (error) {
    console.error('Get job match error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single job
router.get('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('requiredSkills.skill')
      .populate('eligibility.campuses', 'name code')
      .populate('createdBy', 'firstName lastName');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create job (Coordinators only)
router.post('/', auth, authorize('coordinator', 'manager'), [
  body('title').trim().notEmpty(),
  body('company.name').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('location').trim().notEmpty(),
  body('applicationDeadline').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const jobData = {
      ...req.body,
      createdBy: req.userId
    };

    // If CEFR English is specified in eligibility, remove any duplicate 'English' skill from requiredSkills
    if (jobData.eligibility && (jobData.eligibility.englishSpeaking || jobData.eligibility.englishWriting) && Array.isArray(jobData.requiredSkills)) {
      const Skill = require('../models/Skill');
      // Determine which skill IDs correspond to 'English'
      const englishSkills = await Skill.find({ name: { $regex: '^English$', $options: 'i' } }).select('_id');
      const englishIds = englishSkills.map(s => s._id.toString());
      jobData.requiredSkills = jobData.requiredSkills.filter(rs => {
        const sid = rs.skill?._id || rs.skill;
        return !sid || !englishIds.includes(sid.toString());
      });
    }

    const job = new Job(jobData);
    await job.save();

    // Check if job status is visible to students (active or student-visible pipeline stage)
    const settings = await Settings.getSettings();
    const isVisibleToStudents = job.status === 'active' ||
      settings.jobPipelineStages.find(s => s.id === job.status)?.visibleToStudents;

    // Notify eligible students if job is visible
    if (isVisibleToStudents) {
      const eligibleStudents = await User.find({
        role: 'student',
        isActive: true,
        campus: job.eligibility.campuses?.length > 0
          ? { $in: job.eligibility.campuses }
          : { $exists: true }
      });

      const notifications = eligibleStudents.map(student => ({
        recipient: student._id,
        type: 'new_job_posting',
        title: 'New Job Opportunity',
        message: `${job.company.name} is hiring for ${job.title}. Apply now!`,
        link: `/jobs/${job._id}`,
        relatedEntity: { type: 'job', id: job._id }
      }));

      await Notification.insertMany(notifications);
      const discordResult = await discordService.sendJobPosting(job, req.user, eligibleStudents);
      console.log('Discord sendJobPosting result for job', job._id, discordResult);
      if (discordResult) {
        if (discordResult.messageId) job.discordMessageId = discordResult.messageId;
        if (discordResult.threadId) job.discordThreadId = discordResult.threadId;
        if (discordResult.messageId || discordResult.threadId) {
          await job.save();
        }
      }
    }

    res.status(201).json({ message: 'Job created successfully', job });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update job
router.put('/:id', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const settings = await Settings.getSettings();
    const wasVisible = job.status === 'active' ||
      settings.jobPipelineStages.find(s => s.id === job.status)?.visibleToStudents;

    // If CEFR English specified, strip duplicate English skills from requiredSkills to avoid duplicates
    if (req.body.eligibility && (req.body.eligibility.englishSpeaking || req.body.eligibility.englishWriting) && Array.isArray(req.body.requiredSkills)) {
      const Skill = require('../models/Skill');
      const englishSkills = await Skill.find({ name: { $regex: '^English$', $options: 'i' } }).select('_id');
      const englishIds = englishSkills.map(s => s._id.toString());
      req.body.requiredSkills = req.body.requiredSkills.filter(rs => {
        const sid = rs.skill?._id || rs.skill;
        return !sid || !englishIds.includes(sid.toString());
      });
    }

    Object.assign(job, req.body);
    await job.save();

    const isNowVisible = job.status === 'active' ||
      settings.jobPipelineStages.find(s => s.id === job.status)?.visibleToStudents;

    // If job just became visible to students, notify them
    if (!wasVisible && isNowVisible) {
      const eligibleStudents = await User.find({
        role: 'student',
        isActive: true
      });

      const notifications = eligibleStudents.map(student => ({
        recipient: student._id,
        type: 'new_job_posting',
        title: 'New Job Opportunity',
        message: `${job.company.name} is hiring for ${job.title}. Apply now!`,
        link: `/jobs/${job._id}`,
        relatedEntity: { type: 'job', id: job._id }
      }));

      await Notification.insertMany(notifications);
      const discordResult = await discordService.sendJobPosting(job, req.user, eligibleStudents);
      console.log('Discord sendJobPosting result for job', job._id, discordResult);
      if (discordResult) {
        if (discordResult.messageId) job.discordMessageId = discordResult.messageId;
        if (discordResult.threadId) job.discordThreadId = discordResult.threadId;
        if (discordResult.messageId || discordResult.threadId) {
          await job.save();
        }
      }
    }

    res.json({ message: 'Job updated successfully', job });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk update applications for a job (set status, advance round, with optional general feedback)
router.post('/:id/bulk-update', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const jobId = req.params.id;
    const { applicationIds = [], action, status, advanceBy = 1, generalFeedback, perApplicationFeedbacks = {} } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    // Only managers, job coordinator, or job creator can perform bulk updates
    const allowed = req.user.role === 'manager' || (job.coordinator && job.coordinator.toString() === req.userId.toString()) || (job.createdBy && job.createdBy.toString() === req.userId.toString());
    if (!allowed) return res.status(403).json({ message: 'Not authorized for this operation' });

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ message: 'No applicationIds provided' });
    }

    let updated = 0;

    for (const appId of applicationIds) {
      const application = await Application.findById(appId).populate('student', 'firstName lastName');
      if (!application) continue;
      if (application.job.toString() !== jobId.toString()) continue;

      // Apply action
      if (action === 'set_status') {
        // If status provided, update it; otherwise we may only be adding feedback without changing status
        if (status) {
          application.status = status;

          // If moving to in_progress/interviewing, handle round setting
          if ((status === 'in_progress' || status === 'interviewing') && req.body.targetRound !== undefined) {
            application.currentRound = parseInt(req.body.targetRound);

            // Ensure roundResults exists and has an entry for this round
            application.roundResults = application.roundResults || [];
            const existingRound = application.roundResults.find(r => r.round === application.currentRound);
            if (!existingRound) {
              application.roundResults.push({
                round: application.currentRound,
                roundName: req.body.roundName || `Round ${application.currentRound + 1}`,
                status: 'pending',
                evaluatedBy: req.userId,
                evaluatedAt: new Date()
              });
            }
          }
        }

        // Prefer per-application feedback when supplied, otherwise use section general feedback
        const feedbackToApply = perApplicationFeedbacks && perApplicationFeedbacks[appId] ? perApplicationFeedbacks[appId] : generalFeedback;
        if (feedbackToApply) {
          application.feedback = feedbackToApply;
          application.feedbackBy = req.userId;
        }
      } else if (action === 'advance_round') {
        // Legacy: Advance currentRound by `advanceBy` steps
        application.currentRound = (application.currentRound || 0) + parseInt(advanceBy || 1);
        application.status = 'in_progress';

        const feedbackToApply = perApplicationFeedbacks && perApplicationFeedbacks[appId] ? perApplicationFeedbacks[appId] : generalFeedback;
        if (feedbackToApply) {
          application.feedback = feedbackToApply;
          application.feedbackBy = req.userId;
        }

        application.roundResults = application.roundResults || [];
        application.roundResults.push({
          round: application.currentRound,
          roundName: req.body.roundName || `Round ${application.currentRound + 1}`,
          status: 'pending',
          evaluatedBy: req.userId,
          evaluatedAt: new Date()
        });
      } else {
        continue;
      }

      await application.save();

      // Notify student about bulk change (wrapped in try-catch to isolate errors)
      try {
        if (application.student?._id) {
          const feedbackToUse = perApplicationFeedbacks && perApplicationFeedbacks[appId] ? perApplicationFeedbacks[appId] : generalFeedback;

          let notificationMsg = '';
          if (feedbackToUse) {
            notificationMsg = feedbackToUse;
          } else if (status) {
            notificationMsg = `Your application for ${job.title} has been updated to ${application.status}`;
          } else {
            notificationMsg = `New feedback has been added to your application for ${job.title}`;
          }

          await Notification.create({
            recipient: application.student._id,
            type: 'application_update',
            title: `Application Update: ${job.title}`,
            message: notificationMsg,
            link: `/applications/${application._id}`,
            relatedEntity: { type: 'application', id: application._id }
          });
        }
      } catch (notifErr) {
        console.error(`Failed to send notification for application ${appId}:`, notifErr.message);
        // Continue loop even if notification fails
      }

      updated++;
    }

    // Recalculate placementsCount for the job to be authoritative
    const placementsCount = await Application.countDocuments({ job: jobId, status: 'selected' });
    job.placementsCount = placementsCount;

    // If job is fully placed, set status to 'filled'
    if (job.placementsCount >= (job.maxPositions || 1)) {
      job.status = 'filled';
      job.statusHistory = job.statusHistory || [];
      job.statusHistory.push({ status: 'filled', changedAt: new Date(), changedBy: req.userId, notes: 'Positions filled by bulk action' });
    }

    // Generate a natural language description for the timeline
    let journeyDescription = `Batch update performed on ${updated} applicant${updated !== 1 ? 's' : ''}`;
    if (action === 'set_status' && status) {
      journeyDescription = `${updated} applicant${updated !== 1 ? 's' : ''} moved to ${status.replace('_', ' ')}`;
    } else if (action === 'advance_round') {
      journeyDescription = `${updated} applicant${updated !== 1 ? 's' : ''} advanced to Round ${req.body.advanceBy || 1}`;
    }

    // Add a timeline event recording the bulk action
    job.timeline = job.timeline || [];
    job.timeline.push({
      event: 'custom',
      description: journeyDescription,
      changedBy: req.userId,
      changedAt: new Date(),
      metadata: {
        action,
        updated,
        status,
        targetRound: req.body.targetRound,
        roundName: req.body.roundName
      }
    });

    await job.save();

    // Notify Discord (Summary)
    if (updated > 0) {
      await discordService.sendBulkUpdate(
        job,
        updated,
        action === 'set_status' ? `Status: ${status}` : 'Advanced Round',
        req.user
      );
    }

    res.json({ message: 'Bulk update completed', updated });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete job
router.delete('/:id', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    await job.deleteOne();
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update job status (for Kanban drag-and-drop)
router.patch('/:id/status', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { status: newStatus, notes } = req.body;

    if (!newStatus) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Validate status against pipeline stages
    const validStatuses = await Settings.getValidStatuses();
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
      });
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const previousStatus = job.status;

    // Update status
    job.status = newStatus;

    // Add to status history
    job.statusHistory = job.statusHistory || [];
    job.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      changedBy: req.userId,
      notes: notes || ''
    });

    await job.save();

    // Get pipeline settings to check if we should notify students
    const settings = await Settings.getSettings();
    const newStage = settings.jobPipelineStages.find(s => s.id === newStatus);
    const prevStage = settings.jobPipelineStages.find(s => s.id === previousStatus);

    // Notify students if job became visible (moved to a student-visible stage from non-visible)
    const wasVisible = prevStage?.visibleToStudents;
    const isNowVisible = newStage?.visibleToStudents;

    if (!wasVisible && isNowVisible && newStatus !== 'closed' && newStatus !== 'filled') {
      const eligibleStudents = await User.find({
        role: 'student',
        isActive: true,
        campus: job.eligibility.campuses?.length > 0
          ? { $in: job.eligibility.campuses }
          : { $exists: true }
      });

      const notifications = eligibleStudents.map(student => ({
        recipient: student._id,
        type: 'new_job_posting',
        title: 'New Job Opportunity',
        message: `${job.company.name} is hiring for ${job.title}. Apply now!`,
        link: `/jobs/${job._id}`,
        relatedEntity: { type: 'job', id: job._id }
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    // Populate job for response
    await job.populate('requiredSkills.skill');
    await job.populate('eligibility.campuses', 'name');
    await job.populate('createdBy', 'firstName lastName');

    res.json({
      message: 'Job status updated successfully',
      job,
      previousStatus,
      newStatus
    });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// === Interest Request Routes ===

// Submit interest request (for students with <60% match)
router.post('/:id/interest', auth, authorize('student'), [
  body('reason').trim().isLength({ min: 50 }).withMessage('Please provide a detailed reason (at least 50 characters)'),
  body('acknowledgedGaps').isArray(),
  body('improvementPlan').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reason, acknowledgedGaps, improvementPlan } = req.body;
    const jobId = req.params.id;

    // Get job and student
    const job = await Job.findById(jobId).populate('requiredSkills.skill');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const student = await User.findById(req.userId)
      .populate('studentProfile.skills.skill')
      .populate('campus');

    // Calculate match
    const matchDetails = calculateMatch(student, job);

    // Only allow interest requests for <60% match
    if (matchDetails.overallPercentage >= 60) {
      return res.status(400).json({
        message: 'You meet the requirements. Please apply directly instead of showing interest.'
      });
    }

    // Check for existing request
    const existing = await InterestRequest.findOne({
      student: req.userId,
      job: jobId
    });

    if (existing) {
      return res.status(400).json({
        message: `You already have a ${existing.status} interest request for this job.`
      });
    }

    // Create interest request
    const interestRequest = new InterestRequest({
      student: req.userId,
      job: jobId,
      matchDetails: {
        overallPercentage: matchDetails.overallPercentage,
        skillMatch: matchDetails.breakdown.skills,
        eligibilityMatch: matchDetails.breakdown.eligibility.details,
        requirementsMatch: matchDetails.breakdown.requirements
      },
      reason,
      acknowledgedGaps,
      improvementPlan
    });

    await interestRequest.save();

    // Notify Campus PoC
    const campusPoCs = await User.find({
      role: 'campus_poc',
      campus: student.campus?._id,
      isActive: true
    });

    const notifications = campusPoCs.map(poc => ({
      recipient: poc._id,
      type: 'interest_request',
      title: 'New Interest Request',
      message: `${student.firstName} ${student.lastName} has shown interest in ${job.title} at ${job.company.name} (${matchDetails.overallPercentage}% match)`,
      link: `/campus-poc/interest-requests/${interestRequest._id}`,
      relatedEntity: { type: 'interest_request', id: interestRequest._id }
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({
      message: 'Interest request submitted successfully. Your Campus PoC will review it.',
      interestRequest
    });
  } catch (error) {
    console.error('Submit interest error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ALL interest requests for Campus PoC (across all jobs)
router.get('/interest-requests/all', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    // Campus PoC can only see requests from their campus students
    if (req.user.role === 'campus_poc') {
      const campusStudents = await User.find({
        role: 'student',
        campus: req.user.campus
      }).select('_id');
      query.student = { $in: campusStudents.map(s => s._id) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await InterestRequest.countDocuments(query);

    const requests = await InterestRequest.find(query)
      .populate('student', 'firstName lastName email studentProfile.currentSchool studentProfile.enrollmentNumber')
      .populate('job', 'title company applicationDeadline application_stage')
      .populate('reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      requests,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get all interest requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get interest requests for a job (Coordinators/Managers)
router.get('/:id/interest-requests', auth, authorize('coordinator', 'manager', 'campus_poc'), async (req, res) => {
  try {
    const { status } = req.query;
    let query = { job: req.params.id };

    if (status) {
      query.status = status;
    }

    // Campus PoC can only see requests from their campus
    if (req.user.role === 'campus_poc') {
      const campusStudents = await User.find({
        role: 'student',
        campus: req.user.campus
      }).select('_id');
      query.student = { $in: campusStudents.map(s => s._id) };
    }

    const requests = await InterestRequest.find(query)
      .populate('student', 'firstName lastName email studentProfile.currentSchool')
      .populate('reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get interest requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Review interest request (Campus PoC)
router.patch('/interest-requests/:requestId', auth, authorize('campus_poc', 'coordinator', 'manager'), [
  body('status').isIn(['approved', 'rejected']),
  body('reviewNotes').optional().trim(),
  body('rejectionReason').optional().trim()
], async (req, res) => {
  try {
    const { status, reviewNotes, rejectionReason } = req.body;
    const request = await InterestRequest.findById(req.params.requestId)
      .populate('student')
      .populate('job');

    if (!request) {
      return res.status(404).json({ message: 'Interest request not found' });
    }

    // Campus PoC can only review their campus students
    if (req.user.role === 'campus_poc') {
      if (request.student.campus?.toString() !== req.user.campus?.toString()) {
        return res.status(403).json({ message: 'Not authorized to review this request' });
      }
    }

    request.status = status;
    request.reviewedBy = req.userId;
    request.reviewedAt = new Date();
    request.reviewNotes = reviewNotes;

    if (status === 'rejected') {
      request.rejectionReason = rejectionReason || 'Not approved by Campus PoC';
    }

    // If approved, convert or create a regular application so the student has a proper application journey
    if (status === 'approved') {
      try {
        // Find existing interest application
        let interestApp = await Application.findOne({ student: request.student._id, job: request.job._id, applicationType: 'interest' });

        if (interestApp) {
          // Convert to regular application
          interestApp.applicationType = 'regular';
          interestApp.status = 'applied';
          await interestApp.save();
          request.applicationCreated = interestApp._id;
        } else {
          // Create a new regular application on behalf of the student
          const student = await User.findById(request.student._id);
          const newApp = new Application({
            student: request.student._id,
            job: request.job._id,
            resume: student.studentProfile?.resume,
            coverLetter: '',
            customResponses: [],
            applicationType: 'regular',
            status: 'applied'
          });
          await newApp.save();
          request.applicationCreated = newApp._id;
        }
      } catch (err) {
        console.error('Error converting/creating application on interest approval:', err);
      }
    }

    await request.save();

    // Notify student
    const notification = new Notification({
      recipient: request.student._id,
      type: status === 'approved' ? 'interest_approved' : 'interest_rejected',
      title: status === 'approved' ? 'Interest Request Approved!' : 'Interest Request Update',
      message: status === 'approved'
        ? `Your interest in ${request.job.title} at ${request.job.company.name} has been approved. You can now apply!`
        : `Your interest in ${request.job.title} at ${request.job.company.name} was not approved. Reason: ${rejectionReason || 'Not specified'}`,
      link: status === 'approved' && request.applicationCreated ? `/applications/${request.applicationCreated}` : `/student/jobs/${request.job._id}`,
      relatedEntity: { type: 'interest_request', id: request._id }
    });

    await notification.save();

    res.json({
      message: `Interest request ${status}`,
      request
    });
  } catch (error) {
    console.error('Review interest request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// === FAQ Routes ===

// Get questions for a job
router.get('/:id/questions', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('questions.askedBy', 'firstName lastName')
      .populate('questions.answeredBy', 'firstName lastName');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // For students, only return public questions with answers
    const questions = req.user.role === 'student'
      ? job.questions.filter(q => q.isPublic && q.answer)
      : job.questions;

    res.json(questions);
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Ask a question (Students only)
router.post('/:id/questions', auth, authorize('student'), [
  body('question').trim().isLength({ min: 10 }).withMessage('Question must be at least 10 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    job.questions.push({
      question: req.body.question,
      askedBy: req.userId,
      askedAt: new Date()
    });

    await job.save();

    // Notify coordinators about new question
    const coordinators = await User.find({ role: 'coordinator', isActive: true });
    const notifications = coordinators.map(coordinator => ({
      recipient: coordinator._id,
      type: 'job_question',
      title: 'New Question on Job',
      message: `A student has asked a question on ${job.title} at ${job.company.name}`,
      link: `/coordinator/jobs/${job._id}`,
      relatedEntity: { type: 'job', id: job._id }
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({ message: 'Question submitted successfully' });
  } catch (error) {
    console.error('Ask question error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Answer a question (Coordinators/Managers only)
router.patch('/:id/questions/:questionId', auth, authorize('coordinator', 'manager'), [
  body('answer').trim().notEmpty().withMessage('Answer is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const question = job.questions.id(req.params.questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    question.answer = req.body.answer;
    question.answeredBy = req.userId;
    question.answeredAt = new Date();
    question.isPublic = req.body.isPublic !== false; // Default to public

    await job.save();

    // Notify the student who asked
    if (question.askedBy) {
      const notification = new Notification({
        recipient: question.askedBy,
        type: 'question_answered',
        title: 'Your Question Was Answered',
        message: `Your question about ${job.title} has been answered`,
        link: `/student/jobs/${job._id}`,
        relatedEntity: { type: 'job', id: job._id }
      });
      await notification.save();
    }

    res.json({ message: 'Question answered successfully', question });
  } catch (error) {
    console.error('Answer question error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// === Job Timeline/Journey Routes ===

// Add timeline event
router.post('/:id/timeline', auth, authorize('coordinator', 'manager'), [
  body('event').isIn(['created', 'status_changed', 'deadline_extended', 'positions_updated', 'coordinator_assigned', 'custom']),
  body('description').trim().notEmpty()
], async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    job.timeline.push({
      event: req.body.event,
      description: req.body.description,
      changedBy: req.userId,
      changedAt: new Date(),
      metadata: req.body.metadata || {}
    });

    await job.save();

    res.json({ message: 'Timeline event added', timeline: job.timeline });
  } catch (error) {
    console.error('Add timeline event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update expected update date
router.patch('/:id/expected-update', auth, authorize('coordinator', 'manager'), [
  body('expectedUpdateDate').optional().isISO8601(),
  body('expectedUpdateNote').optional().trim()
], async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    job.expectedUpdateDate = req.body.expectedUpdateDate || null;
    job.expectedUpdateNote = req.body.expectedUpdateNote || '';

    // Add to timeline
    job.timeline.push({
      event: 'custom',
      description: `Expected update date set: ${req.body.expectedUpdateDate ? new Date(req.body.expectedUpdateDate).toLocaleDateString() : 'Cleared'}`,
      changedBy: req.userId,
      changedAt: new Date()
    });

    await job.save();

    res.json({ message: 'Expected update date updated', job });
  } catch (error) {
    console.error('Update expected update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign coordinator to job
router.patch('/:id/coordinator', auth, authorize('manager'), [
  body('coordinatorId').notEmpty()
], async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const coordinator = await User.findOne({ _id: req.body.coordinatorId, role: 'coordinator' });
    if (!coordinator) {
      return res.status(404).json({ message: 'Coordinator not found' });
    }

    job.coordinator = coordinator._id;

    // Add to timeline
    job.timeline.push({
      event: 'coordinator_assigned',
      description: `${coordinator.firstName} ${coordinator.lastName} assigned as job coordinator`,
      changedBy: req.userId,
      changedAt: new Date(),
      metadata: { coordinatorId: coordinator._id }
    });

    await job.save();

    // Notify coordinator
    const notification = new Notification({
      recipient: coordinator._id,
      type: 'job_assigned',
      title: 'Job Assigned to You',
      message: `You have been assigned as coordinator for ${job.title} at ${job.company.name}`,
      link: `/coordinator/jobs/${job._id}`,
      relatedEntity: { type: 'job', id: job._id }
    });
    await notification.save();

    res.json({ message: 'Coordinator assigned successfully', job });
  } catch (error) {
    console.error('Assign coordinator error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get coordinators with their job counts (for Manager dashboard)
router.get('/stats/coordinator-jobs', auth, authorize('manager'), async (req, res) => {
  try {
    const coordinatorStats = await Job.aggregate([
      { $match: { coordinator: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$coordinator',
          totalJobs: { $sum: 1 },
          activeJobs: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          closedJobs: { $sum: { $cond: [{ $in: ['$status', ['closed', 'filled']] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'coordinator'
        }
      },
      { $unwind: '$coordinator' },
      {
        $project: {
          _id: 1,
          coordinatorName: { $concat: ['$coordinator.firstName', ' ', '$coordinator.lastName'] },
          coordinatorEmail: '$coordinator.email',
          totalJobs: 1,
          activeJobs: 1,
          closedJobs: 1
        }
      }
    ]);

    res.json(coordinatorStats);
  } catch (error) {
    console.error('Get coordinator stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Export job applications with field selection
router.post('/:id/export', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fields, format = 'csv' } = req.body;
    const Application = require('../models/Application');
    const { JobReadinessConfig, StudentJobReadiness } = require('../models/JobReadiness');

    // Check if job exists
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Get applications for this job with comprehensive population
    const applications = await Application.find({ job: id })
      .populate({
        path: 'student',
        select: 'firstName lastName email phone gender studentProfile campus',
        populate: [
          { path: 'campus', select: 'name code' },
          { path: 'studentProfile.skills.skill', select: 'name' }
        ]
      })
      .populate('job', 'title company.name location jobType salary customRequirements')
      .populate('feedbackBy', 'firstName lastName');

    // Get job readiness data for students
    const studentIds = applications.map(app => app.student._id);
    const jobReadinessData = await StudentJobReadiness.find({
      student: { $in: studentIds }
    }).populate('student', 'firstName lastName');

    // Create job readiness lookup
    const jobReadinessLookup = {};
    jobReadinessData.forEach(jrd => {
      jobReadinessLookup[jrd.student._id.toString()] = jrd;
    });

    // Enhanced field mapping with all student data
    const fieldMap = {
      // Basic Student Info
      studentName: (app) => `${app.student.firstName} ${app.student.lastName}`,
      email: (app) => app.student.email,
      phone: (app) => app.student.phone || '',
      gender: (app) => app.student.gender || '',

      // Campus Info
      campus: (app) => app.student.campus?.name || '',
      campusCode: (app) => app.student.campus?.code || '',

      // Navgurukul Education
      currentSchool: (app) => app.student.studentProfile?.currentSchool || '',
      joiningDate: (app) => app.student.studentProfile?.dateOfJoining ? new Date(app.student.studentProfile.dateOfJoining).toLocaleDateString() : '',
      currentModule: (app) => app.student.studentProfile?.currentModule || '',
      customModuleDescription: (app) => app.student.studentProfile?.customModuleDescription || '',
      attendance: (app) => app.student.studentProfile?.attendancePercentage || '',

      // Academic Background
      tenthBoard: (app) => app.student.studentProfile?.tenthGrade?.board || '',
      tenthPercentage: (app) => app.student.studentProfile?.tenthGrade?.percentage || '',
      tenthPassingYear: (app) => app.student.studentProfile?.tenthGrade?.passingYear || '',
      tenthState: (app) => app.student.studentProfile?.tenthGrade?.state || '',

      twelfthBoard: (app) => app.student.studentProfile?.twelfthGrade?.board || '',
      twelfthPercentage: (app) => app.student.studentProfile?.twelfthGrade?.percentage || '',
      twelfthPassingYear: (app) => app.student.studentProfile?.twelfthGrade?.passingYear || '',
      twelfthState: (app) => app.student.studentProfile?.twelfthGrade?.state || '',

      // Higher Education
      higherEducation: (app) => app.student.studentProfile?.higherEducation?.map(edu =>
        `${edu.degree} in ${edu.fieldOfStudy} from ${edu.institution} (${edu.startYear}-${edu.endYear})`
      ).join('; ') || '',

      // Location Info
      hometown: (app) => {
        const hometown = app.student.studentProfile?.hometown;
        if (!hometown) return '';
        return `${hometown.village || ''}, ${hometown.district || ''}, ${hometown.state || ''} - ${hometown.pincode || ''}`.replace(/^,\s*|,\s*$/g, '');
      },

      // Skills
      technicalSkills: (app) => app.student.studentProfile?.technicalSkills?.map(skill =>
        `${skill.skillName} (${skill.selfRating}/4)`
      ).join('; ') || '',

      // Soft Skills
      communication: (app) => app.student.studentProfile?.softSkills?.communication || '',
      collaboration: (app) => app.student.studentProfile?.softSkills?.collaboration || '',
      creativity: (app) => app.student.studentProfile?.softSkills?.creativity || '',
      criticalThinking: (app) => app.student.studentProfile?.softSkills?.criticalThinking || '',
      problemSolving: (app) => app.student.studentProfile?.softSkills?.problemSolving || '',
      adaptability: (app) => app.student.studentProfile?.softSkills?.adaptability || '',
      timeManagement: (app) => app.student.studentProfile?.softSkills?.timeManagement || '',
      leadership: (app) => app.student.studentProfile?.softSkills?.leadership || '',
      teamwork: (app) => app.student.studentProfile?.softSkills?.teamwork || '',
      emotionalIntelligence: (app) => app.student.studentProfile?.softSkills?.emotionalIntelligence || '',

      // Language Skills
      languages: (app) => app.student.studentProfile?.languages?.map(lang =>
        `${lang.language} (S:${lang.speaking}, W:${lang.writing})`
      ).join('; ') || '',

      // English Proficiency (legacy)
      englishSpeaking: (app) => app.student.studentProfile?.englishProficiency?.speaking || '',
      englishWriting: (app) => app.student.studentProfile?.englishProficiency?.writing || '',

      // Courses
      courses: (app) => app.student.studentProfile?.courses?.map(course =>
        `${course.courseName} (${course.provider})`
      ).join('; ') || '',

      // Open for roles
      openForRoles: (app) => app.student.studentProfile?.openForRoles?.join('; ') || '',

      // Profile Links
      linkedIn: (app) => app.student.studentProfile?.linkedIn || '',
      github: (app) => app.student.studentProfile?.github || '',
      portfolio: (app) => app.student.studentProfile?.portfolio || '',
      resume: (app) => app.student.studentProfile?.resume || '',

      // About & Expectations
      about: (app) => app.student.studentProfile?.about || '',
      expectedSalary: (app) => app.student.studentProfile?.expectedSalary || '',

      // Profile Status
      profileStatus: (app) => app.student.studentProfile?.profileStatus || '',

      // Job Info
      jobTitle: (app) => app.job.title,
      company: (app) => app.job.company.name,
      location: (app) => app.job.location,
      jobType: (app) => app.job.jobType,
      salary: (app) => app.job.salary?.min && app.job.salary?.max ? `${app.job.salary.min}-${app.job.salary.max}` : '',

      // Application Info
      status: (app) => app.status,
      appliedDate: (app) => app.createdAt.toISOString().split('T')[0],
      coverLetter: (app) => app.coverLetter || '',
      feedback: (app) => app.feedback || '',
      currentRound: (app) => app.currentRound || 0,

      // Custom Requirements Responses
      customResponses: (app) => app.customResponses?.map(cr =>
        `${cr.requirement}: ${cr.response ? 'Yes' : 'No'}`
      ).join('; ') || '',

      // Job Readiness Data
      jobReadinessCompleted: (app) => {
        const jrd = jobReadinessLookup[app.student._id.toString()];
        return jrd ? 'Yes' : 'No';
      },
      jobReadinessStatus: (app) => {
        const jrd = jobReadinessLookup[app.student._id.toString()];
        return jrd?.status || 'Not Started';
      },
      jobReadinessCriteria: (app) => {
        const jrd = jobReadinessLookup[app.student._id.toString()];
        if (!jrd?.criteria) return '';
        return jrd.criteria.map(c =>
          `${c.name}: ${c.studentResponse || c.studentLink || (c.completed ? 'Completed' : 'Pending')}`
        ).join('; ');
      }
    };

    // Use selected fields or all fields
    const selectedFields = fields?.length > 0 ? fields : Object.keys(fieldMap);
    const layout = req.body.layout || 'resume'; // 'resume' or 'table'

    // Handle different export formats
    if (format === 'pdf') {
      // Generate PDF export
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        info: {
          Title: `Job Applications Report - ${job.title}`,
          Author: 'NavGurukul Placement Dashboard',
          Subject: `Applications for ${job.title} at ${job.company.name}`,
          Creator: 'NavGurukul Placement System'
        }
      });

      // Set response headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_applications_report.pdf"`);

      doc.pipe(res);

      // Add NavGurukul Header
      doc.fontSize(24).fillColor('#1e40af').text('NavGurukul', 50, 50);
      doc.fontSize(10).fillColor('#64748b').text('Placement Dashboard', 50, 78);

      // Add title
      doc.fontSize(18).fillColor('#000').text('Job Applications Report', 50, 110, { align: 'center' });

      // Add separator line
      doc.moveTo(50, 140).lineTo(545, 140).strokeColor('#e5e7eb').stroke();

      // Add job details in a structured format
      let yPosition = 160;
      doc.fontSize(14).fillColor('#1f2937');

      // Job Information Section
      doc.text('Job Information', 50, yPosition, { underline: true });
      yPosition += 25;

      const jobInfo = [
        ['Position:', job.title],
        ['Company:', job.company.name],
        ['Location:', job.location],
        ['Job Type:', job.jobType.replace('_', ' ').toUpperCase()],
        ['Total Applications:', applications.length.toString()],
        ['Report Generated:', new Date().toLocaleDateString('en-IN', {
          year: 'numeric', month: 'long', day: 'numeric'
        })]
      ];

      jobInfo.forEach(([label, value]) => {
        doc.fontSize(10).fillColor('#6b7280').text(label, 50, yPosition, { continued: true, width: 120 });
        doc.fillColor('#000').text(value, 170, yPosition);
        yPosition += 18;
      });

      yPosition += 20;

      // Applications Section - supports resume or table layout
      if (applications.length === 0) {
        doc.fontSize(12).fillColor('#ef4444').text('No applications found for this job.', 50, yPosition);
      } else {
        // Top-level heading only on first page
        doc.fontSize(14).fillColor('#1f2937').text('Student Applications', 50, yPosition, { underline: true });
        yPosition += 30;

        if (layout === 'resume') {
          const { drawResumeCard } = require('../utils/pdfHelpers');

          const cardsPerPage = 2;
          const pagePaddingTop = yPosition; // starting y for first card on each page
          const availableHeight = doc.page.height - pagePaddingTop - 120; // leave space for footer
          const cardHeight = Math.floor((availableHeight - 10) / cardsPerPage);
          const cardWidth = 495; // 595 A4 width - margins 50*2 = 495
          const totalPages = Math.ceil(applications.length / cardsPerPage);
          let currentPage = 0;

          applications.forEach((app, index) => {
            const isFirstOnPage = (index % cardsPerPage) === 0;
            if (isFirstOnPage && index !== 0) {
              doc.addPage();
              currentPage += 1;
              // small header on new pages
              doc.fontSize(12).fillColor('#0b4cff').text(`${job.title} — Applications (Page ${currentPage + 1} of ${totalPages})`, 50, 50);
            }

            const startY = isFirstOnPage ? pagePaddingTop : pagePaddingTop + cardHeight + 10;

            drawResumeCard(doc, app, 50, startY, cardWidth, cardHeight);

            // If last card on page or last overall, add footer
            const isLastOnPage = ((index % cardsPerPage) === (cardsPerPage - 1)) || (index === applications.length - 1);
            if (isLastOnPage) {
              const footerY = doc.page.height - 60;
              doc.fontSize(8).fillColor('#9ca3af')
                .text('Generated by NavGurukul Placement Dashboard', 50, footerY)
                .text(new Date().toISOString().split('T')[0], 450, footerY);
            }
          });
        } else {
          // Compact table layout - one row per student, auto-paginate
          const headersRow = selectedFields.map(f => f.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim());
          const colWidth = Math.floor((495 - 20) / headersRow.length);
          let tableY = yPosition;

          // Draw table header
          doc.fontSize(9).fillColor('#475569');
          headersRow.forEach((h, i) => {
            doc.text(h, 50 + i * colWidth, tableY, { width: colWidth, ellipsis: true });
          });
          tableY += 18;

          applications.forEach((app, idx) => {
            // New page if needed
            if (tableY > doc.page.height - 120) {
              doc.addPage();
              tableY = 60;
            }

            selectedFields.forEach((field, i) => {
              const value = fieldMap[field] ? fieldMap[field](app) : '';
              doc.fontSize(9).fillColor('#0f172a').text(String(value).slice(0, 80), 50 + i * colWidth, tableY, { width: colWidth, ellipsis: true });
            });
            tableY += 16;

            // Footer per page when needed
            if (tableY > doc.page.height - 120 || idx === applications.length - 1) {
              const footerY = doc.page.height - 60;
              doc.fontSize(8).fillColor('#9ca3af')
                .text('Generated by NavGurukul Placement Dashboard', 50, footerY)
                .text(new Date().toISOString().split('T')[0], 450, footerY);
            }
          });
        }
      }

      // Add footer
      doc.fontSize(8).fillColor('#9ca3af')
        .text('Generated by NavGurukul Placement Dashboard', 50, 780)
        .text(new Date().toISOString().split('T')[0], 450, 780);

      doc.end();
      return;
    }

    // Generate CSV (default)
    // Generate headers
    const headers = selectedFields.map(f => {
      // Convert camelCase to Title Case
      return f.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
    });

    // Generate rows
    const rows = applications.map(app =>
      selectedFields.map(field => {
        const value = fieldMap[field] ? fieldMap[field](app) : '';
        // Clean and escape CSV data
        const strValue = String(value).replace(/"/g, '""').replace(/[\r\n]/g, ' ').trim();
        return strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')
          ? `"${strValue}"`
          : strValue;
      })
    );

    // Create CSV
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_applications.csv`);
    res.send('\uFEFF' + csv); // Add BOM for Excel UTF-8 compatibility
  } catch (error) {
    console.error('Export job applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
