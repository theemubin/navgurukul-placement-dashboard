const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const Notification = require('../models/Notification');
const PlacementCycle = require('../models/PlacementCycle');
const { StudentJobReadiness } = require('../models/JobReadiness');
const discordService = require('../services/discordService');
const { auth, authorize, sameCampus } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');
const cacheService = require('../services/redisCacheService');

/**
 * @swagger
 * tags:
 *   name: Applications
 *   description: Job application management
 */

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: List applications (role-filtered)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: job
 *         schema:
 *           type: string
 *         description: Filter by job ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: student
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: myLeads
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: summary
 *         schema:
 *           type: string
 *           enum: [counts, triage, lite]
 *         description: Return a reduced payload for counts, triage view, or the student list
 *     responses:
 *       200:
 *         description: Paginated application list
 *       401:
 *         description: Unauthorized
 */
// Get applications (filtered by role)
router.get('/', auth, async (req, res) => {
  try {
    const { job, status, student, page = 1, limit = 20, myLeads, summary, search, daysBucket } = req.query;
    let query = {};

    // Debug: log incoming filter params in development to help troubleshoot 304/cache/status issues
    if (process.env.NODE_ENV === 'development') {
      console.log('[Debug] GET /api/applications filters:', { job, status, student, page, limit, myLeads, role: req.user?.role, userId: req.userId });
    }

    // If requesting 'myLeads' and user is coordinator, filter to jobs that this coordinator leads
    if (myLeads === 'true' && req.user && req.user.role === 'coordinator') {
      const coordinatorJobs = await Job.find({ coordinator: req.userId }).select('_id');
      query.job = { $in: coordinatorJobs.map(j => j._id) };
    }

    // Students can only see their own applications
    if (req.user.role === 'student') {
      query.student = req.userId;
    } else {
      if (student) query.student = student;
    }

    if (job) query.job = job;

    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    } else {
      // By default, exclude 'interested' status applications for coordinators and managers (unless a specific job is queried)
      if ((req.user.role === 'coordinator' || req.user.role === 'manager') && !job) {
        query.status = { $ne: 'interested' };
      }
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      const searchRegex = new RegExp(searchTerm, 'i');

      const [matchedStudents, matchedJobs] = await Promise.all([
        User.find({
          role: 'student',
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { 'studentProfile.enrollmentNumber': searchRegex }
          ]
        }).select('_id'),
        Job.find({
          $or: [
            { title: searchRegex },
            { 'company.name': searchRegex }
          ]
        }).select('_id')
      ]);

      const studentIds = matchedStudents.map(student => student._id);
      const jobIds = matchedJobs.map(jobDoc => jobDoc._id);

      if (studentIds.length === 0 && jobIds.length === 0) {
        return res.json({
          applications: [],
          pagination: {
            current: parseInt(page),
            pages: 0,
            total: 0
          }
        });
      }

      query.$or = [];
      if (studentIds.length > 0) query.$or.push({ student: { $in: studentIds } });
      if (jobIds.length > 0) query.$or.push({ job: { $in: jobIds } });
    }

    if (daysBucket) {
      const now = Date.now();
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);
      const twentyDaysAgo = new Date(now - 20 * 24 * 60 * 60 * 1000);

      if (daysBucket === 'green') {
        query.createdAt = { ...(query.createdAt || {}), $gte: tenDaysAgo };
      } else if (daysBucket === 'yellow') {
        query.createdAt = { ...(query.createdAt || {}), $lt: tenDaysAgo, $gte: twentyDaysAgo };
      } else if (daysBucket === 'red') {
        query.createdAt = { ...(query.createdAt || {}), $lt: twentyDaysAgo };
      }
    }

    // Campus POC can only see applications from their allowed campus students (primary and managed)
    if (req.user.role === 'campus_poc') {
      const allowedCampuses = [];
      if (req.user.campus) allowedCampuses.push(req.user.campus.toString());
      if (req.user.managedCampuses && req.user.managedCampuses.length > 0) {
        req.user.managedCampuses.forEach(c => {
          const cid = c.toString();
          if (!allowedCampuses.includes(cid)) allowedCampuses.push(cid);
        });
      }
      const campusStudents = await User.find({
        role: 'student',
        campus: { $in: allowedCampuses }
      }).select('_id');
      query.student = { $in: campusStudents.map(s => s._id) };
    }

    if (summary === 'counts') {
      const countsByStatus = await Application.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const statusMap = countsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      const total = Object.values(statusMap).reduce((sum, value) => sum + value, 0);

      return res.json({
        counts: {
          total,
          applied: statusMap.applied || 0,
          interested: statusMap.interested || 0,
          shortlisted: (statusMap.shortlisted || 0) + (statusMap.hr_shortlisting || 0),
          in_progress: (statusMap.in_progress || 0) + (statusMap.interviewing || 0) + (statusMap.application_stage || 0),
          selected: statusMap.selected || 0,
          rejected: statusMap.rejected || 0,
          withdrawn: statusMap.withdrawn || 0
        }
      });
    }

    if (summary === 'triage') {
      const applications = await Application.find(query)
        .select('student job status currentRound roundResults specialRecommendation feedback createdAt updatedAt')
        .populate('student', 'firstName lastName email studentProfile.currentModule studentProfile.enrollmentNumber campus')
        .populate({
          path: 'student',
          populate: { path: 'campus', select: 'name' }
        })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      const total = await Application.countDocuments(query);

      return res.json({
        applications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    }

    if (summary === 'lite') {
      const applications = await Application.find(query)
          .select('student job status statusComment currentRound roundResults createdAt updatedAt')
          .populate('student', 'firstName lastName email studentProfile.currentSchool studentProfile.currentModule studentProfile.resume')
        .populate('job', 'title company.name jobType status interviewRounds')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      const total = await Application.countDocuments(query);

      return res.json({
        applications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    }

    const applications = await Application.find(query)
      .populate('student', 'firstName lastName email studentProfile.enrollmentNumber campus')
      .populate({
        path: 'student',
        populate: { path: 'campus', select: 'name' }
      })
      .populate('job', 'title company.name status')
      .populate('specialRecommendation.recommendedBy', 'firstName lastName')
      .populate('feedbackBy', 'firstName lastName')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Application.countDocuments(query);

    res.json({
      applications,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/{id}:
 *   get:
 *     summary: Get a single application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application details
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 */
// Get single application
router.get('/:id', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('student', 'firstName lastName email studentProfile campus')
      .populate({
        path: 'student',
        populate: [
          { path: 'campus', select: 'name' },
          { path: 'studentProfile.skills.skill' }
        ]
      })
      .populate('job')
      .populate('specialRecommendation.recommendedBy', 'firstName lastName')
      .populate('roundResults.evaluatedBy', 'firstName lastName')
      .populate('feedbackBy', 'firstName lastName');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Students can only view their own applications
    if (req.user.role === 'student' && application.student._id.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(application);
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications:
 *   post:
 *     summary: Apply for a job (students only)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jobId]
 *             properties:
 *               jobId:
 *                 type: string
 *               coverLetter:
 *                 type: string
 *               customResponses:
 *                 type: object
 *               type:
 *                 type: string
 *                 default: regular
 *     responses:
 *       201:
 *         description: Application submitted
 *       400:
 *         description: Validation error or already applied
 *       404:
 *         description: Job not found
 */
// Apply for a job (Students only)
router.post('/', auth, authorize('student'), [
  body('jobId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId, coverLetter, customResponses, type = 'regular', selectedResumeId } = req.body;

    // Check if job exists and is active
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Accept applications for pipeline statuses that are open for applications
    const openJobStatuses = ['active', 'application_stage', 'hr_shortlisting', 'interviewing'];
    if (!openJobStatuses.includes(job.status)) {
      return res.status(400).json({ message: 'This job is not accepting applications' });
    }

    if (new Date() > job.applicationDeadline) {
      return res.status(400).json({ message: 'Application deadline has passed' });
    }

    // --- Job Readiness Check ---
    const studentReadiness = await StudentJobReadiness.findOne({ student: req.userId });
    const readinessRequirement = job.eligibility?.readinessRequirement || 'no';

    if (type === 'regular') {
      if (readinessRequirement === 'yes') {
        if (!studentReadiness || studentReadiness.readinessPercentage < 100) {
          return res.status(403).json({
            message: 'You must be 100% Job Ready to apply for this position.',
            readinessPercentage: studentReadiness?.readinessPercentage || 0
          });
        }
      } else if (readinessRequirement === 'in_progress') {
        if (!studentReadiness || studentReadiness.readinessPercentage < 30) {
          return res.status(403).json({
            message: 'You must be at least 30% Job Ready (Under Process) to apply for this position.',
            readinessPercentage: studentReadiness?.readinessPercentage || 0
          });
        }
      }
    } else if (type === 'interest') {
      // Interest can be shown even if not ready
      if (studentReadiness && studentReadiness.readinessPercentage === 100) {
        return res.status(400).json({ message: 'You are already 100% Job Ready. Please apply directly!' });
      }
    }

    // Validate mandatory custom requirements only for regular applications (students confirm during Apply)
    if (type === 'regular' && job.customRequirements && job.customRequirements.length > 0) {
      const mandatoryRequirements = job.customRequirements.filter(req => req.isMandatory);
      for (const req of mandatoryRequirements) {
        // customResponses should contain objects like { requirement: <string>, response: true }
        const response = customResponses?.find(r => r.requirement === req.requirement);
        if (!response || !response.response) {
          return res.status(400).json({ message: `You must agree to: "${req.requirement}"` });
        }
      }
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      student: req.userId,
      job: jobId
    });

    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied for this job' });
    }

    // Get student's resume
    const student = await User.findById(req.userId);

    let resumeUrl = student.studentProfile?.resume;
    let resumeSnapshot = null;

    if (selectedResumeId && student.studentProfile?.resumes) {
      const selectedResume = student.studentProfile.resumes.find(
        r => r._id.toString() === selectedResumeId.toString()
      );
      if (selectedResume) {
        resumeUrl = selectedResume.url;
        resumeSnapshot = {
          role: selectedResume.role,
          url: selectedResume.url,
          publicId: selectedResume.publicId,
          uploadedAt: selectedResume.uploadedAt
        };
      }
    }

    if (!resumeSnapshot) {
      resumeSnapshot = {
        role: 'Primary',
        url: resumeUrl || student.studentProfile?.resume || student.studentProfile?.resumeLink || '',
        publicId: '',
        uploadedAt: new Date()
      };
      if (!resumeUrl) {
        resumeUrl = resumeSnapshot.url;
      }
    }

    const application = new Application({
      student: req.userId,
      job: jobId,
      resume: resumeUrl,
      resumeSnapshot,
      coverLetter,
      customResponses: customResponses || [],
      applicationType: type,
      status: type === 'interest' ? 'interested' : 'applied'
    });

    await application.save();
    await cacheService.invalidateApplicationCache(req.userId);

    // Notify coordinators
    const coordinators = await User.find({ role: 'coordinator', isActive: true });
    const notifications = coordinators.map(coordinator => ({
      recipient: coordinator._id,
      type: 'application_update',
      title: type === 'interest' ? 'Expression of Interest' : 'New Application',
      message: type === 'interest'
        ? `${student.firstName} ${student.lastName} is interested in ${job.title} at ${job.company.name}`
        : `${student.firstName} ${student.lastName} has applied for ${job.title} at ${job.company.name}`,
      link: `/applications/${application._id}`,
      relatedEntity: { type: 'application', id: application._id }
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({ message: 'Application submitted successfully', application });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/{id}/status:
 *   put:
 *     summary: Update application status
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, shortlisted, interviewing, selected, rejected, withdrawn]
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 *       404:
 *         description: Not found
 */
// Update application status (Coordinators only)
router.put('/:id/status', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { status, feedback, comment } = req.body;
    const note = (comment ?? feedback ?? '').toString().trim();
    const requiresNote = ['selected', 'rejected'].includes(status);

    if (requiresNote && !note) {
      return res.status(400).json({ message: 'Coordinator note is required for selected and rejected status changes.' });
    }

    const application = await Application.findById(req.params.id)
      .populate('job', 'title company.name')
      .populate('student');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Record previous status and push to history
    const prevStatus = application.status;
    application.status = status;
    if (note) {
      application.statusComment = note;
    }
    if (feedback) {
      application.feedback = feedback;
      application.feedbackBy = req.userId;
    }

    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({ status, changedAt: new Date(), changedBy: req.userId, comment: note });

    // Update placement count if selected or filled
    if (status === 'selected' || status === 'filled') {
      await Job.findByIdAndUpdate(application.job._id, {
        $inc: { placementsCount: 1 }
      });

      // Update student's placement cycle to current month
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

      let cycle = await PlacementCycle.findOne({ month: currentMonth, year: currentYear });

      if (!cycle) {
        // Create the cycle if it doesn't exist
        cycle = await PlacementCycle.create({
          name: `${months[currentMonth - 1]} ${currentYear}`,
          month: currentMonth,
          year: currentYear,
          status: 'active',
          createdBy: req.userId
        });
      }

      // Update student's placement cycle and status in User model
      await User.findByIdAndUpdate(application.student, {
        'studentProfile.currentStatus': 'Placed',
        placementCycle: cycle._id,
        placementCycleAssignedAt: new Date(),
        placementCycleAssignedBy: req.userId
      });

      // Update student's status in current cycle snapshot to 'placed'
      await PlacementCycle.updateOne(
        { _id: cycle._id, 'snapshotStudents.student': application.student },
        { $set: { 'snapshotStudents.$.status': 'placed' } }
      );
    }

    await application.save();
    await cacheService.invalidateApplicationCache(application.student._id || application.student);

    // Notify student
    await Notification.create({
      recipient: application.student._id,
      type: status === 'selected' ? 'placement_confirmed' : 'application_update',
      title: 'Application Status Update',
      message: `Your application for ${application.job.title} at ${application.job.company.name} has been ${status}`,
      link: `/applications/${application._id}`,
      relatedEntity: { type: 'application', id: application._id }
    });

    // Send to Discord
    await discordService.sendApplicationUpdate(application, application.job, application.student, req.user);

    res.json({ message: 'Application status updated', application });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/{id}/rounds:
 *   put:
 *     summary: Update interview round result
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               round:
 *                 type: integer
 *               roundName:
 *                 type: string
 *               status:
 *                 type: string
 *               score:
 *                 type: number
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Round result updated
 *       404:
 *         description: Not found
 */
// Update interview round result
router.put('/:id/rounds', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { round, roundName, status, score, feedback } = req.body;

    const application = await Application.findById(req.params.id)
      .populate('job', 'title company.name');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Find or create round result
    let roundResult = application.roundResults.find(r => r.round === round);

    if (roundResult) {
      roundResult.status = status;
      roundResult.score = score;
      roundResult.feedback = feedback;
      roundResult.evaluatedBy = req.userId;
      roundResult.evaluatedAt = new Date();
    } else {
      application.roundResults.push({
        round,
        roundName,
        status,
        score,
        feedback,
        evaluatedBy: req.userId,
        evaluatedAt: new Date()
      });
    }

    // Update current round and record status changes
    application.statusHistory = application.statusHistory || [];
    if (status === 'passed') {
      application.currentRound = round + 1;
      application.status = 'in_progress';
      application.statusHistory.push({ status: 'in_progress', changedAt: new Date(), changedBy: req.userId, comment: `Round ${round} passed` });
    } else if (status === 'failed') {
      application.status = 'rejected';
      application.statusHistory.push({ status: 'rejected', changedAt: new Date(), changedBy: req.userId, comment: `Round ${round} failed` });
    }

    await application.save();
    await cacheService.invalidateApplicationCache(application.student);

    // Notify student
    await Notification.create({
      recipient: application.student,
      type: 'feedback_received',
      title: 'Interview Round Update',
      message: `Your ${roundName || `Round ${round}`} for ${application.job.title} at ${application.job.company.name} has been evaluated`,
      link: `/applications/${application._id}`,
      relatedEntity: { type: 'application', id: application._id }
    });

    res.json({ message: 'Round result updated', application });
  } catch (error) {
    console.error('Update round error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/{id}/recommend:
 *   put:
 *     summary: Add special recommendation (Campus POC)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Recommendation added
 *       404:
 *         description: Not found
 */
// Add special recommendation (Campus POCs)
router.put('/:id/recommend', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const { reason } = req.body;

    const application = await Application.findById(req.params.id)
      .populate('student', 'campus firstName lastName')
      .populate('job', 'title company.name');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Verify student is from same campus
    if (application.student.campus?.toString() !== req.user.campus?.toString()) {
      return res.status(403).json({ message: 'You can only recommend students from your campus' });
    }

    application.specialRecommendation = {
      isRecommended: true,
      recommendedBy: req.userId,
      reason,
      recommendedAt: new Date()
    };

    await application.save();
    await cacheService.invalidateApplicationCache(application.student._id || application.student);

    // Notify coordinators
    const coordinators = await User.find({ role: 'coordinator', isActive: true });
    const notifications = coordinators.map(coordinator => ({
      recipient: coordinator._id,
      type: 'recommendation_received',
      title: 'Special Recommendation',
      message: `${application.student.firstName} ${application.student.lastName} has received a special recommendation for ${application.job.title}`,
      link: `/applications/${application._id}`,
      relatedEntity: { type: 'application', id: application._id }
    }));

    await Notification.insertMany(notifications);

    res.json({ message: 'Recommendation added', application });
  } catch (error) {
    console.error('Add recommendation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/{id}/withdraw:
 *   put:
 *     summary: Withdraw an application (student)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application withdrawn
 *       403:
 *         description: Not your application
 *       404:
 *         description: Not found
 */
// Withdraw application (Students only)
router.put('/:id/withdraw', auth, authorize('student'), async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      student: req.userId
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (['selected', 'withdrawn'].includes(application.status)) {
      return res.status(400).json({ message: 'Cannot withdraw this application' });
    }

    application.status = 'withdrawn';
    await application.save();
    await cacheService.invalidateApplicationCache(req.userId);

    res.json({ message: 'Application withdrawn successfully' });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/export/csv:
 *   get:
 *     summary: Export applications as CSV
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: job
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
// Export applications data
router.get('/export/csv', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { job, status, campus } = req.query;
    let query = {};

    if (job) query.job = job;
    if (status) query.status = status;

    if (campus) {
      const campusStudents = await User.find({
        role: 'student',
        campus
      }).select('_id');
      query.student = { $in: campusStudents.map(s => s._id) };
    }

    const applications = await Application.find(query)
      .populate('student', 'firstName lastName email studentProfile.enrollmentNumber studentProfile.department campus')
      .populate({
        path: 'student',
        populate: { path: 'campus', select: 'name' }
      })
      .populate('job', 'title company.name location jobType');

    // Generate CSV
    const headers = ['Student Name', 'Email', 'Enrollment No', 'Department', 'Campus', 'LinkedIn', 'GitHub', 'Portfolio', 'Job Title', 'Company', 'Status', 'Applied Date'];
    const rows = applications.map(app => [
      `${app.student.firstName} ${app.student.lastName}`,
      app.student.email,
      app.student.studentProfile?.enrollmentNumber || '',
      app.student.studentProfile?.department || '',
      app.student.campus?.name || '',
      app.student.studentProfile?.linkedIn || '',
      app.student.studentProfile?.github || '',
      app.student.studentProfile?.portfolio || '',
      app.job.title,
      app.job.company.name,
      app.status,
      app.createdAt.toISOString().split('T')[0]
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=applications-export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/export/xls:
 *   post:
 *     summary: Export applications as XLS (tab-separated)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               job:
 *                 type: string
 *               status:
 *                 type: string
 *               campus:
 *                 type: string
 *               fields:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: XLS file download
 */
// Export applications with field selection (XLS format)
router.post('/export/xls', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { job, status, campus, fields } = req.body;
    let query = {};

    if (job) query.job = job;
    if (status) query.status = status;

    if (campus) {
      const campusStudents = await User.find({
        role: 'student',
        campus
      }).select('_id');
      query.student = { $in: campusStudents.map(s => s._id) };
    }

    const applications = await Application.find(query)
      .populate({
        path: 'student',
        populate: [
          { path: 'campus', select: 'name code' },
          { path: 'studentProfile.skills.skill', select: 'name' }
        ]
      })
      .populate('job', 'title company.name location jobType salary')
      .populate('feedbackBy', 'firstName lastName');

    // Helper for skill rating to labels
    const ratingToLevel = (rating) => {
      const num = parseInt(rating);
      if (num >= 4) return 'Expert';
      if (num >= 3) return 'Advanced';
      if (num >= 2) return 'Intermediate';
      if (num >= 1) return 'Basic';
      return '';
    };

    // Available fields mapping (Ordered for exports)
    const fieldMap = {
      // 1. Basic Student Info
      studentName: (app) => `${app.student?.firstName || ''} ${app.student?.lastName || ''}`.trim(),
      email: (app) => app.student?.email || '',
      phone: (app) => app.student?.phone || '',
      gender: (app) => app.student?.gender || '',
      campus: (app) => app.student?.campus?.name || '',
      hometown: (app) => {
        const h = app.student?.studentProfile?.hometown;
        if (!h) return '';
        return [h.village, h.district, h.state, h.pincode].filter(p => p).join(', ');
      },
      about: (app) => app.student?.studentProfile?.about || '',

      // 2. Education (Navgurukul)
      school: (app) => app.student?.studentProfile?.currentSchool || '',
      joiningDate: (app) => app.student?.studentProfile?.joiningDate ? new Date(app.student.studentProfile.joiningDate).toLocaleDateString() : '',
      currentModule: (app) => app.student?.studentProfile?.currentModule || '',
      attendance: (app) => app.student?.studentProfile?.attendancePercentage || '',

      // 3. Profile Links
      resume: (app) => {
        const profile = app.student?.studentProfile;
        const link = app.resume || profile?.resumeLink || '';
        if (link && (link.startsWith('http'))) return link;
        if (profile?.resume) {
          const baseUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : '';
          return `${baseUrl}/${profile.resume}`.replace(/\/+/g, '/').replace(':/', '://');
        }
        return link || '';
      },
      github: (app) => app.student?.studentProfile?.github || '',
      portfolio: (app) => app.student?.studentProfile?.portfolio || '',
      linkedIn: (app) => app.student?.studentProfile?.linkedIn || '',

      // 4. Academic Background
      professionalExperience: (app) => app.student?.studentProfile?.professionalExperience || '',
      higherEducation: (app) => {
        const eduList = app.student?.studentProfile?.higherEducation || [];
        return eduList.map(edu =>
          `${edu.degree || 'Degree'} - ${edu.institution || 'N/A'} (${edu.startYear || '?'}-${edu.endYear || '?'})`
        ).join('; ');
      },
      tenthBoard: (app) => app.student?.studentProfile?.tenthGrade?.board || '',
      tenthPercentage: (app) => app.student?.studentProfile?.tenthGrade?.percentage || '',
      tenthPassingYear: (app) => app.student?.studentProfile?.tenthGrade?.passingYear || '',
      twelfthBoard: (app) => app.student?.studentProfile?.twelfthGrade?.board || '',
      twelfthPercentage: (app) => app.student?.studentProfile?.twelfthGrade?.percentage || '',
      twelfthPassingYear: (app) => app.student?.studentProfile?.twelfthGrade?.passingYear || '',

      // 5. Skills & Rest
      technicalSkills: (app) => {
        const skills = app.student?.studentProfile?.technicalSkills || [];
        return skills.map(s => `${s.skillName} - ${ratingToLevel(s.selfRating)}`).filter(s => !s.endsWith(' - ')).join('; ');
      },
      communication: (app) => {
        const skill = app.student?.studentProfile?.softSkills?.find(s => s.skillName?.toLowerCase().includes('communication'));
        return skill ? ratingToLevel(skill.selfRating) : '';
      },
      collaboration: (app) => {
        const skill = app.student?.studentProfile?.softSkills?.find(s => s.skillName?.toLowerCase().includes('collaboration'));
        return skill ? ratingToLevel(skill.selfRating) : '';
      },
      problemSolving: (app) => {
        const skill = app.student?.studentProfile?.softSkills?.find(s => s.skillName?.toLowerCase().includes('problem solving'));
        return skill ? ratingToLevel(skill.selfRating) : '';
      },
      languages: (app) => {
        const langs = app.student?.studentProfile?.languages || [];
        return langs.map(l => `${l.language} (S:${l.speaking}, W:${l.writing})`).join('; ');
      },
      courses: (app) => {
        const courses = app.student?.studentProfile?.courses || [];
        return courses.map(c => `${c.courseName} (${c.provider})`).join('; ');
      },
      jobTitle: (app) => app.job?.title || '',
      company: (app) => app.job?.company?.name || '',
      location: (app) => app.job?.location || '',
      status: (app) => app.status || '',
      appliedDate: (app) => app.createdAt ? new Date(app.createdAt).toISOString().split('T')[0] : '',
      expectedSalary: (app) => app.student?.studentProfile?.expectedSalary || '',
      coverLetter: (app) => app.coverLetter || '',
      feedback: (app) => app.feedback || app.coordinatorFeedback || ''
    };

    // Maintain consistent column order based on fieldMap indices
    // Priority fields that must always come first if selected
    const fixedPriority = [
      'studentName', 'campus', 'school', 'joiningDate',
      'resume', 'github', 'portfolio', 'linkedIn'
    ];

    const incomingFields = fields?.length > 0 ? fields : Object.keys(fieldMap);

    // Sort logic: priority list first, then rest in selection order
    const prioritizedSelection = fixedPriority.filter(pk => incomingFields.includes(pk));
    const dynamicSelection = incomingFields.filter(ik => !fixedPriority.includes(ik));

    const selectedFields = [...prioritizedSelection, ...dynamicSelection];

    // Generate headers
    const headers = selectedFields.map(f => {
      // Convert camelCase to Title Case
      return f.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
    });

    // Generate rows
    const rows = applications.map(app =>
      selectedFields.map(field => {
        const value = fieldMap[field] ? fieldMap[field](app) : '';
        // Escape quotes and wrap in quotes if contains comma
        const strValue = String(value);
        return strValue.includes(',') || strValue.includes('"')
          ? `"${strValue.replace(/"/g, '""')}"`
          : strValue;
      })
    );

    // Create TSV (Tab Separated Values) for easy Excel import
    const tsv = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=applications-export.xls');
    res.send(bom + tsv);
  } catch (error) {
    console.error('Export XLS error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/analytics/bottlenecks:
 *   get:
 *     summary: Macro funnel analytics and pipeline dwell times
 *     tags: [Applications]
 *     parameters:
 *       - in: query
 *         name: campus
 *         schema:
 *           type: string
 *       - in: query
 *         name: minDays
 *         schema:
 *           type: integer
 *           default: 7
 *       - in: query
 *         name: roleCategory
 *         schema:
 *           type: string
 *       - in: query
 *         name: cycleId
 *         schema:
 *           type: string
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Bypass Redis cache and recompute the analytics once
 */
router.get('/analytics/bottlenecks', auth, authorize('coordinator', 'campus_poc', 'manager'), cacheMiddleware({ type: 'analytics', keyPrefix: 'applications' }), async (req, res) => {
  try {
    const { campus, minDays = 7, roleCategory, cycleId } = req.query;

    let studentFilter = {};
    if (req.user.role === 'campus_poc') {
      studentFilter.campus = req.user.campus;
    } else if (campus) {
      studentFilter.campus = mongoose.Types.ObjectId.isValid(campus) ? new mongoose.Types.ObjectId(campus) : campus;
    }

    const studentIds = (await User.find({ role: 'student', ...studentFilter }).select('_id')).map(s => s._id);

    let appMatch = {
      student: { $in: studentIds }
    };

    if (roleCategory || cycleId) {
      let jobMatch = {};
      if (roleCategory) jobMatch.roleCategory = roleCategory;
      if (cycleId) jobMatch.placementCycle = mongoose.Types.ObjectId.isValid(cycleId) ? new mongoose.Types.ObjectId(cycleId) : cycleId;
      const matchingJobIds = (await Job.find(jobMatch).select('_id')).map(j => j._id);
      appMatch.job = { $in: matchingJobIds };
    }

    const allApps = await Application.find(appMatch)
      .select('status createdAt updatedAt job student')
      .populate('job', 'title company.name roleCategory createdAt')
      .populate('student', 'firstName lastName campus');

    const now = new Date();
    const thresholdMs = Number(minDays) * 24 * 60 * 60 * 1000;

    const stageMap = {};
    let totalApplications = allApps.length;
    let totalStagnant = 0;
    let totalOffered = 0;
    let totalRejected = 0;

    allApps.forEach(app => {
      const status = app.status || 'applied';
      if (!stageMap[status]) {
        stageMap[status] = { count: 0, totalDays: 0, stagnantCount: 0 };
      }
      stageMap[status].count += 1;

      const lastUpdated = new Date(app.updatedAt || app.createdAt);
      const daysInStage = Math.max(1, Math.round((now - lastUpdated) / (1000 * 60 * 60 * 24)));
      stageMap[status].totalDays += daysInStage;

      const isTerminal = ['selected', 'rejected', 'withdrawn', 'offered'].includes(status.toLowerCase());
      if (!isTerminal && (now - lastUpdated) > thresholdMs) {
        stageMap[status].stagnantCount += 1;
        totalStagnant += 1;
      }

      if (['selected', 'offered'].includes(status.toLowerCase())) totalOffered += 1;
      if (status.toLowerCase() === 'rejected') totalRejected += 1;
    });

    const desiredStageOrder = [
      'applied',
      'interested',
      'application_stage',
      'withdrawn',
      'hr_shortlisting',
      'interviewing',
      'rejected',
      'filled'
    ];

    const getStageOrderIndex = (stage) => {
      const lower = (stage || '').toLowerCase().trim();
      let idx = desiredStageOrder.indexOf(lower);
      if (idx !== -1) return idx;

      if (lower.includes('reject')) return desiredStageOrder.indexOf('rejected');
      if (lower.includes('hr') || lower.includes('shortlist')) return desiredStageOrder.indexOf('hr_shortlisting');
      if (lower.includes('interest')) return desiredStageOrder.indexOf('interested');
      if (lower === 'applied') return desiredStageOrder.indexOf('applied');
      if (lower.includes('stage') || lower.includes('pending') || lower.includes('review')) return desiredStageOrder.indexOf('application_stage');
      if (lower.includes('withdraw')) return desiredStageOrder.indexOf('withdrawn');
      if (lower.includes('fill') || lower.includes('select') || lower.includes('offer') || lower.includes('place')) return desiredStageOrder.indexOf('filled');
      if (lower.includes('interview')) return desiredStageOrder.indexOf('interviewing');

      return 999;
    };

    const stageBreakdown = Object.keys(stageMap).map(st => ({
      stage: st,
      count: stageMap[st].count,
      avgDaysInStage: parseFloat((stageMap[st].totalDays / stageMap[st].count).toFixed(1)),
      stagnantCount: stageMap[st].stagnantCount
    })).sort((a, b) => getStageOrderIndex(a.stage) - getStageOrderIndex(b.stage));

    const companyStagnantMap = {};
    allApps.forEach(app => {
      const status = (app.status || '').toLowerCase();
      const isTerminal = ['selected', 'rejected', 'withdrawn', 'offered'].includes(status);
      const lastUpdated = new Date(app.updatedAt || app.createdAt);
      if (!isTerminal && (now - lastUpdated) > thresholdMs && app.job?.company?.name) {
        const compName = app.job.company.name;
        const daysStuck = Math.max(1, Math.round((now - lastUpdated) / (1000 * 60 * 60 * 24)));
        const jobTitle = app.job?.title || 'Unknown Role';
        const candidateName = app.student ? `${app.student.firstName} ${app.student.lastName}` : 'Candidate';
        const studentId = app.student?._id;
        const postingDate = app.job?.createdAt ? new Date(app.job.createdAt).toISOString().split('T')[0] : null;

        if (!companyStagnantMap[compName]) {
          companyStagnantMap[compName] = {
            company: compName,
            stagnantCount: 0,
            totalDays: 0,
            rolesMap: {}
          };
        }
        companyStagnantMap[compName].stagnantCount += 1;
        companyStagnantMap[compName].totalDays += daysStuck;

        if (!companyStagnantMap[compName].rolesMap[jobTitle]) {
          companyStagnantMap[compName].rolesMap[jobTitle] = {
            jobTitle,
            postingDate,
            stagnantCount: 0,
            totalDays: 0,
            stagesMap: {},
            candidates: []
          };
        }

        const roleObj = companyStagnantMap[compName].rolesMap[jobTitle];
        roleObj.stagnantCount += 1;
        roleObj.totalDays += daysStuck;
        roleObj.stagesMap[app.status] = (roleObj.stagesMap[app.status] || 0) + 1;
        roleObj.candidates.push({
          studentId,
          name: candidateName,
          stage: app.status,
          daysStuck
        });
      }
    });

    const companyBottlenecks = Object.values(companyStagnantMap)
      .map(c => {
        const roles = Object.values(c.rolesMap).map(r => ({
          jobTitle: r.jobTitle,
          postingDate: r.postingDate,
          stagnantCount: r.stagnantCount,
          avgDaysStagnant: parseFloat((r.totalDays / r.stagnantCount).toFixed(1)),
          stages: Object.entries(r.stagesMap).map(([stage, count]) => ({ stage, count })),
          candidates: r.candidates
        })).sort((a, b) => b.stagnantCount - a.stagnantCount);

        const postingDates = Array.from(new Set(roles.map(r => r.postingDate).filter(Boolean))).sort();

        return {
          company: c.company,
          stagnantCount: c.stagnantCount,
          avgDaysStagnant: parseFloat((c.totalDays / c.stagnantCount).toFixed(1)),
          jobTitles: roles.map(r => r.jobTitle),
          postingDates,
          roles
        };
      })
      .sort((a, b) => b.stagnantCount - a.stagnantCount)
      .slice(0, 10);

    res.json({
      totalApplications,
      totalStagnant,
      totalOffered,
      totalRejected,
      stageBreakdown,
      companyBottlenecks
    });
  } catch (error) {
    console.error('Bottlenecks analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/analytics/stagnant-students:
 *   get:
 *     summary: List students with stagnant applications
 *     tags: [Applications]
 *     parameters:
 *       - in: query
 *         name: campus
 *         schema:
 *           type: string
 *       - in: query
 *         name: minDays
 *         schema:
 *           type: integer
 *           default: 7
 *       - in: query
 *         name: stage
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: school
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Bypass Redis cache and recompute the list once
 */
router.get('/analytics/stagnant-students', auth, authorize('coordinator', 'campus_poc', 'manager'), cacheMiddleware({ type: 'analytics', keyPrefix: 'applications' }), async (req, res) => {
  try {
    const { campus, minDays = 7, stage, status, search, school, page = 1, limit = 20 } = req.query;
    const thresholdDate = new Date(Date.now() - Number(minDays) * 24 * 60 * 60 * 1000);
    const terminalStatuses = ['selected', 'rejected', 'withdrawn', 'offered'];
    const stageFilter = stage || status;

    const activeStatuses = stageFilter
      ? String(stageFilter).split(',').map(s => s.trim()).filter(Boolean)
      : terminalStatuses;

    const buildStudentRow = (student, stagnant, totals) => ({
      student: {
        _id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        campus: student.campus?.name || 'N/A',
        joiningDate: student.studentProfile?.joiningDate || null,
        monthsSpent: (() => {
          const sourceDate = student.studentProfile?.joiningDate || student.createdAt;
          if (!sourceDate) return null;
          const startDate = new Date(sourceDate);
          if (isNaN(startDate.getTime())) return null;
          return Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        })(),
        enrollmentNumber: student.studentProfile?.enrollmentNumber || '',
        department: student.studentProfile?.department || '',
        currentSchool: student.studentProfile?.currentSchool || ''
      },
      stagnantCount: stagnant.stagnantCount || 0,
      maxDaysStuck: stagnant.maxDaysStuck || 0,
      totalApplications: totals.totalApplications || 0,
      rejectionCount: totals.rejectionCount || 0,
      stagnantApplications: []
    });

    const hasStudentScope = req.user.role === 'campus_poc' || campus || school || search;

    const totalsByStudent = new Map();
    const stagnantByStudent = new Map();
    let rows = [];
    let totalRows = 0;

    if (hasStudentScope) {
      let studentFilter = { role: 'student' };
      if (req.user.role === 'campus_poc') {
        studentFilter.campus = req.user.campus;
      } else if (campus) {
        studentFilter.campus = mongoose.Types.ObjectId.isValid(campus) ? new mongoose.Types.ObjectId(campus) : campus;
      }

      if (school) {
        studentFilter['studentProfile.currentSchool'] = new RegExp(school, 'i');
      }

      if (search) {
        const regex = new RegExp(search, 'i');
        studentFilter.$or = [
          { firstName: regex },
          { lastName: regex },
          { email: regex },
          { 'studentProfile.enrollmentNumber': regex }
        ];
      }

      const students = await User.find(studentFilter)
        .select('_id firstName lastName email campus studentProfile createdAt')
        .populate('campus', 'name');

      const studentIds = students.map(s => s._id);
      if (studentIds.length === 0) {
        return res.json({ students: [], total: 0, page: Number(page), totalPages: 0 });
      }

      const totalCounts = await Application.aggregate([
        { $match: { student: { $in: studentIds } } },
        {
          $group: {
            _id: '$student',
            totalApplications: { $sum: 1 },
            rejectionCount: {
              $sum: {
                $cond: [{ $eq: [{ $toLower: '$status' }, 'rejected'] }, 1, 0]
              }
            }
          }
        }
      ]);

      const stagnantAggregates = await Application.aggregate([
        {
          $match: {
            student: { $in: studentIds },
            status: stageFilter ? { $in: activeStatuses } : { $nin: terminalStatuses },
            updatedAt: { $lte: thresholdDate }
          }
        },
        {
          $addFields: {
            daysStuck: {
              $dateDiff: {
                startDate: { $ifNull: ['$updatedAt', '$createdAt'] },
                endDate: '$$NOW',
                unit: 'day'
              }
            }
          }
        },
        {
          $group: {
            _id: '$student',
            stagnantCount: { $sum: 1 },
            maxDaysStuck: { $max: '$daysStuck' },
            totalDaysStuck: { $sum: '$daysStuck' }
          }
        }
      ]);

      totalCounts.forEach(item => totalsByStudent.set(String(item._id), item));
      stagnantAggregates.forEach(item => stagnantByStudent.set(String(item._id), item));

      rows = students
        .map(student => {
          const stagnant = stagnantByStudent.get(String(student._id));
          if (!stagnant) return null;
          const totals = totalsByStudent.get(String(student._id)) || { totalApplications: 0, rejectionCount: 0 };
          return buildStudentRow(student, stagnant, totals);
        })
        .filter(Boolean)
        .sort((a, b) => b.maxDaysStuck - a.maxDaysStuck);

      totalRows = rows.length;
    } else {
      const stagnantGroups = await Application.aggregate([
        {
          $match: {
            status: stage ? { $in: activeStatuses } : { $nin: terminalStatuses },
            updatedAt: { $lte: thresholdDate }
          }
        },
        {
          $group: {
            _id: '$student',
            stagnantCount: { $sum: 1 },
            maxDaysStuck: { $max: { $dateDiff: { startDate: { $ifNull: ['$updatedAt', '$createdAt'] }, endDate: '$$NOW', unit: 'day' } } },
            totalDaysStuck: { $sum: { $dateDiff: { startDate: { $ifNull: ['$updatedAt', '$createdAt'] }, endDate: '$$NOW', unit: 'day' } } }
          }
        },
        { $sort: { maxDaysStuck: -1 } }
      ]);

      totalRows = stagnantGroups.length;
      const startIndex = (Number(page) - 1) * Number(limit);
      const paginatedGroups = stagnantGroups.slice(startIndex, startIndex + Number(limit));
      const topStudentIds = paginatedGroups.map(item => item._id);

      if (topStudentIds.length === 0) {
        return res.json({ students: [], total: totalRows, page: Number(page), totalPages: Math.ceil(totalRows / Number(limit)) });
      }

      const studentDocs = await User.find({ role: 'student', _id: { $in: topStudentIds } })
        .select('_id firstName lastName email campus studentProfile createdAt')
        .populate('campus', 'name');

      const totals = await Application.aggregate([
        { $match: { student: { $in: topStudentIds } } },
        {
          $group: {
            _id: '$student',
            totalApplications: { $sum: 1 },
            rejectionCount: {
              $sum: {
                $cond: [{ $eq: [{ $toLower: '$status' }, 'rejected'] }, 1, 0]
              }
            }
          }
        }
      ]);

      totals.forEach(item => totalsByStudent.set(String(item._id), item));
      paginatedGroups.forEach(item => stagnantByStudent.set(String(item._id), item));

      rows = studentDocs
        .map(student => {
          const stagnant = stagnantByStudent.get(String(student._id));
          if (!stagnant) return null;
          const totalsForStudent = totalsByStudent.get(String(student._id)) || { totalApplications: 0, rejectionCount: 0 };
          return buildStudentRow(student, stagnant, totalsForStudent);
        })
        .filter(Boolean)
        .sort((a, b) => b.maxDaysStuck - a.maxDaysStuck);
    }

    res.json({
      students: rows,
      total: totalRows,
      page: Number(page),
      totalPages: Math.ceil(totalRows / Number(limit))
    });
  } catch (error) {
    console.error('Stagnant students query error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/analytics/student-360/:studentId:
 *   get:
 *     summary: Get complete 360 degree placement report for a student
 *     tags: [Applications]
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: detailLevel
 *         schema:
 *           type: string
 *           enum: [summary, full]
 *           default: summary
 *         description: Return a lightweight report summary or the full application timeline
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Bypass Redis cache and recompute the report once
 */
router.get('/analytics/student-360/:studentId', auth, authorize('coordinator', 'campus_poc', 'manager'), cacheMiddleware({ type: 'analytics', keyPrefix: 'applications' }), async (req, res) => {
  try {
    const { studentId } = req.params;
    const detailLevel = (req.query.detailLevel || 'summary').toString().toLowerCase();
    const summaryMode = detailLevel !== 'full';

    const getMonthsSpent = (joiningDate, createdAt) => {
      const sourceDate = joiningDate || createdAt;
      if (!sourceDate) return null;
      const startDate = new Date(sourceDate);
      if (isNaN(startDate.getTime())) return null;
      const months = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      return months;
    };

    const student = await User.findById(studentId)
      .populate('campus', 'name code')
      .select('firstName lastName email phone campus studentProfile role createdAt');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (req.user.role === 'campus_poc' && student.campus?._id?.toString() !== req.user.campus?.toString()) {
      return res.status(403).json({ message: 'Not authorized to view student from another campus' });
    }

    let jobReadiness = await StudentJobReadiness.findOne({ student: studentId });

    const applicationQuery = Application.find({ student: studentId })
      .populate('job', 'title company location roleCategory salary jobType')
      .sort({ createdAt: -1 });

    const applications = summaryMode
      ? await applicationQuery.select('status applicationType currentRound statusComment createdAt updatedAt job')
      : await applicationQuery
        .populate('feedbackBy', 'firstName LastName'.replace('LastName', 'lastName'))
        .populate('interventions.createdBy', 'firstName lastName role');

    const now = new Date();
    const thresholdMs = 7 * 24 * 60 * 60 * 1000;

    let activeCount = 0;
    let stagnantCount = 0;
    let offeredCount = 0;
    let rejectedCount = 0;
    let totalDaysInPipeline = 0;

    const roundStats = {
      screeningPassed: 0,
      screeningFailed: 0,
      techPassed: 0,
      techFailed: 0,
      hrPassed: 0,
      hrFailed: 0
    };

    const formattedApplications = applications.map(app => {
      const status = (app.status || 'applied').toLowerCase();
      const isTerminal = ['selected', 'rejected', 'withdrawn', 'offered'].includes(status);
      const lastUpdated = new Date(app.updatedAt || app.createdAt);
      const daysInStage = Math.max(1, Math.round((now - lastUpdated) / (1000 * 60 * 60 * 24)));
      totalDaysInPipeline += daysInStage;

      const isStagnant = !isTerminal && (now - lastUpdated) > thresholdMs;

      if (!isTerminal) activeCount += 1;
      if (isStagnant) stagnantCount += 1;
      if (['selected', 'offered'].includes(status)) offeredCount += 1;
      if (status === 'rejected') rejectedCount += 1;

      if (!summaryMode && app.roundResults && app.roundResults.length > 0) {
        app.roundResults.forEach(r => {
          const name = (r.roundName || '').toLowerCase();
          if (name.includes('aptitude') || name.includes('screening') || name.includes('test')) {
            if (r.status === 'passed') roundStats.screeningPassed += 1;
            if (r.status === 'failed') roundStats.screeningFailed += 1;
          } else if (name.includes('tech') || name.includes('coding') || name.includes('technical')) {
            if (r.status === 'passed') roundStats.techPassed += 1;
            if (r.status === 'failed') roundStats.techFailed += 1;
          } else if (name.includes('hr') || name.includes('cultural') || name.includes('managerial')) {
            if (r.status === 'passed') roundStats.hrPassed += 1;
            if (r.status === 'failed') roundStats.hrFailed += 1;
          }
        });
      }

      return {
        _id: app._id,
        job: app.job,
        status: app.status,
        applicationType: app.applicationType,
        currentRound: app.currentRound,
        roundResults: summaryMode ? [] : (app.roundResults || []),
        feedback: summaryMode ? null : app.feedback,
        feedbackBy: summaryMode ? null : (app.feedbackBy ? `${app.feedbackBy.firstName} ${app.feedbackBy.lastName}` : null),
        statusComment: app.statusComment,
        statusHistory: summaryMode ? [] : (app.statusHistory || []),
        interventions: summaryMode ? [] : (app.interventions || []),
        resume: summaryMode ? null : app.resume,
        daysInStage,
        isStagnant,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt
      };
    });

    const diagnosticAlert = stagnantCount >= 1
      ? {
        riskLevel: 'warning',
        bottleneckStage: 'Pending Stage Response',
        message: `Student has ${stagnantCount} active application(s) awaiting movement for over 7 days.`
      }
      : {
        riskLevel: 'low',
        bottleneckStage: 'Normal Progression',
        message: 'Student pipeline metrics are progression-steady with no severe bottlenecks detected.'
      };

    const summaryStats = {
      totalApplications: applications.length,
      activeApplications: activeCount,
      stagnantApplications: stagnantCount,
      totalOffered: offeredCount,
      totalRejected: rejectedCount,
      avgDaysInPipeline: applications.length > 0 ? parseFloat((totalDaysInPipeline / applications.length).toFixed(1)) : 0,
      roundStats
    };

    res.json({
      student: {
        _id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        phone: student.phone,
        campus: student.campus?.name || 'Unassigned',
        joiningDate: student.studentProfile?.joiningDate || null,
        monthsSpent: getMonthsSpent(student.studentProfile?.joiningDate, student.createdAt),
        enrollmentNumber: student.studentProfile?.enrollmentNumber || '',
        department: student.studentProfile?.department || '',
        currentSchool: student.studentProfile?.currentSchool || '',
        skills: student.studentProfile?.technicalSkills || [],
        jobReadiness: jobReadiness ? {
          overallStatus: jobReadiness.overallStatus,
          score: jobReadiness.readinessScore || null
        } : null
      },
      summaryStats,
      diagnosticAlert,
      applications: formattedApplications
    });
  } catch (error) {
    console.error('Student 360 error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/:id/interventions:
 *   post:
 *     summary: Log PoC/Coordinator intervention for an application
 *     tags: [Applications]
 */
router.post('/:id/interventions', auth, authorize('coordinator', 'campus_poc', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType, note, remedialTag } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ message: 'Intervention note is required' });
    }

    const application = await Application.findById(id).populate('student', 'firstName lastName campus email');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (req.user.role === 'campus_poc' && application.student?.campus?.toString() !== req.user.campus?.toString()) {
      return res.status(403).json({ message: 'Not authorized to log intervention for student of another campus' });
    }

    const newIntervention = {
      actionType: actionType || 'other',
      note: note.trim(),
      remedialTag: remedialTag || '',
      createdBy: req.userId,
      createdAt: new Date()
    };

    application.interventions.push(newIntervention);
    await application.save();

    await application.populate('interventions.createdBy', 'firstName lastName role');

    res.json({
      message: 'Intervention logged successfully',
      interventions: application.interventions
    });
  } catch (error) {
    console.error('Log intervention error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/applications/export/fields:
 *   get:
 *     summary: Get available export field options
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of exportable field groups
 */
// Get available export fields
router.get('/export/fields', auth, authorize('coordinator', 'manager'), async (req, res) => {
  const fields = [
    // 1. Basic Student Info (PERSONEL)
    { key: 'studentName', label: 'Student Name', category: 'Student Info' },
    { key: 'email', label: 'Email', category: 'Student Info' },
    { key: 'phone', label: 'Phone', category: 'Student Info' },
    { key: 'gender', label: 'Gender', category: 'Student Info' },
    { key: 'campus', label: 'Campus Name', category: 'Campus Info' },
    { key: 'hometown', label: 'Hometown Details', category: 'Student Info' },
    { key: 'about', label: 'About/Bio', category: 'Student Info' },
    // 2. Education (Navgurukul)
    { key: 'currentSchool', label: 'Current School (Navgurukul)', category: 'Navgurukul Education' },
    { key: 'joiningDate', label: 'Joining Date', category: 'Navgurukul Education' },
    { key: 'currentModule', label: 'Current Module', category: 'Navgurukul Education' },
    { key: 'attendance', label: 'Attendance %', category: 'Navgurukul Education' },

    // 3. Profile Links & Documents
    { key: 'resume', label: 'Resume URL', category: 'Profile Links' },
    { key: 'github', label: 'GitHub Profile', category: 'Profile Links' },
    { key: 'portfolio', label: 'Portfolio Website', category: 'Profile Links' },
    { key: 'linkedIn', label: 'LinkedIn Profile', category: 'Profile Links' },

    // 4. academic background & Experience
    { key: 'professionalExperience', label: 'Professional Experience', category: 'Experience' },
    { key: 'higherEducation', label: 'Higher Education Details', category: 'Academic Background' },

    // Academic Background - Schooling
    { key: 'tenthBoard', label: '10th Board', category: 'Academic Background' },
    { key: 'tenthPercentage', label: '10th Percentage', category: 'Academic Background' },
    { key: 'tenthPassingYear', label: '10th Passing Year', category: 'Academic Background' },
    { key: 'twelfthBoard', label: '12th Board', category: 'Academic Background' },
    { key: 'twelfthPercentage', label: '12th Percentage', category: 'Academic Background' },
    { key: 'twelfthPassingYear', label: '12th Passing Year', category: 'Academic Background' },

    // 4. Skills
    { key: 'technicalSkills', label: 'Technical Skills', category: 'Skills' },
    { key: 'communication', label: 'Communication Skill', category: 'Soft Skills' },
    { key: 'collaboration', label: 'Collaboration Skill', category: 'Soft Skills' },
    { key: 'problemSolving', label: 'Problem Solving Skill', category: 'Soft Skills' },
    { key: 'languages', label: 'Language Proficiency', category: 'Language Skills' },
    { key: 'courses', label: 'Completed Courses', category: 'Learning & Development' },

    // 5. Rest / Job Info / Application
    { key: 'jobTitle', label: 'Job Title', category: 'Job Info' },
    { key: 'company', label: 'Company', category: 'Job Info' },
    { key: 'status', label: 'Application Status', category: 'Application' },
    { key: 'appliedDate', label: 'Applied Date', category: 'Application' },
    { key: 'currentRound', label: 'Interview Round', category: 'Application' },
    { key: 'feedback', label: 'Interview Feedback', category: 'Application' },
    { key: 'expectedSalary', label: 'Expected Salary', category: 'Career Preferences' },
    { key: 'jobReadinessStatus', label: 'Job Readiness Status', category: 'Job Readiness' }
  ];
  res.json(fields);
});

module.exports = router;
