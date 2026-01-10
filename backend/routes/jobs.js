const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Job = require('../models/Job');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const Skill = require('../models/Skill');
const InterestRequest = require('../models/InterestRequest');
const { auth, authorize } = require('../middleware/auth');
const AIService = require('../services/aiService');
const { calculateMatch, getJobsWithMatch } = require('../services/matchService');
const multer = require('multer');

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

    // Get AI config from settings
    const settings = await Settings.getSettings();
    const apiKey = settings.aiConfig?.googleApiKey;

    // Get existing skills for better matching
    let existingSkills = [];
    let skillNames = [];
    try {
      existingSkills = await Skill.find({ isActive: true }).select('name');
      skillNames = existingSkills.map(s => s.name);
    } catch (skillError) {
      console.warn('Could not fetch skills:', skillError.message);
    }

    const aiService = new AIService(apiKey);
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
    
    // Try AI parsing first, fallback to regex
    if (apiKey && settings.aiConfig?.enabled !== false) {
      try {
        parsedData = await aiService.parseJobDescription(text, skillNames);
        parsedData.parsedWith = 'ai';
      } catch (aiError) {
        console.error('AI parsing failed, using fallback:', aiError.message);
        parsedData = aiService.parseJobDescriptionFallback(text);
        parsedData.parsedWith = 'fallback';
        parsedData.aiError = aiError.message;
      }
    } else {
      // No API key - use fallback
      parsedData = aiService.parseJobDescriptionFallback(text);
      parsedData.parsedWith = 'fallback';
      parsedData.aiError = 'AI not configured. Using basic extraction.';
    }

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

    res.json({
      success: true,
      data: parsedData,
      message: parsedData.parsedWith === 'ai' 
        ? 'Job description parsed successfully with AI' 
        : 'Parsed with basic extraction. Add Google AI API key in Settings for better results.'
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
      page = 1, limit = 20 
    } = req.query;

    let query = {};

    // Students only see active jobs
    if (req.user.role === 'student') {
      query.status = 'active';
      query.applicationDeadline = { $gte: new Date() };
      
      // Filter by student's campus
      if (req.user.campus) {
        query.$or = [
          { 'eligibility.campuses': { $size: 0 } },
          { 'eligibility.campuses': req.user.campus }
        ];
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

    res.json({
      jobs,
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

    // Get all active jobs that meet basic criteria
    const jobs = await Job.find({
      status: 'active',
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
      .populate('eligibility.campuses', 'name code');

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

    const job = new Job(jobData);
    await job.save();

    // Notify eligible students if job is active
    if (job.status === 'active') {
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

    const wasNotActive = job.status !== 'active';
    Object.assign(job, req.body);
    await job.save();

    // If job just became active, notify students
    if (wasNotActive && job.status === 'active') {
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
    }

    res.json({ message: 'Job updated successfully', job });
  } catch (error) {
    console.error('Update job error:', error);
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

    await request.save();

    // Notify student
    const notification = new Notification({
      recipient: request.student._id,
      type: status === 'approved' ? 'interest_approved' : 'interest_rejected',
      title: status === 'approved' ? 'Interest Request Approved!' : 'Interest Request Update',
      message: status === 'approved'
        ? `Your interest in ${request.job.title} at ${request.job.company.name} has been approved. You can now apply!`
        : `Your interest in ${request.job.title} at ${request.job.company.name} was not approved. Reason: ${rejectionReason || 'Not specified'}`,
      link: `/student/jobs/${request.job._id}`,
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
      { $group: { 
        _id: '$coordinator', 
        totalJobs: { $sum: 1 },
        activeJobs: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        closedJobs: { $sum: { $cond: [{ $in: ['$status', ['closed', 'filled']] }, 1, 0] } }
      }},
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'coordinator'
      }},
      { $unwind: '$coordinator' },
      { $project: {
        _id: 1,
        coordinatorName: { $concat: ['$coordinator.firstName', ' ', '$coordinator.lastName'] },
        coordinatorEmail: '$coordinator.email',
        totalJobs: 1,
        activeJobs: 1,
        closedJobs: 1
      }}
    ]);

    res.json(coordinatorStats);
  } catch (error) {
    console.error('Get coordinator stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
