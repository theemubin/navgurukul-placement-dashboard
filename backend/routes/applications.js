const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const Notification = require('../models/Notification');
const PlacementCycle = require('../models/PlacementCycle');
const { auth, authorize, sameCampus } = require('../middleware/auth');

// Get applications (filtered by role)
router.get('/', auth, async (req, res) => {
  try {
    const { job, status, student, page = 1, limit = 20 } = req.query;
    let query = {};

    // Students can only see their own applications
    if (req.user.role === 'student') {
      query.student = req.userId;
    } else {
      if (student) query.student = student;
    }

    if (job) query.job = job;
    if (status) query.status = status;

    // Campus POC can only see applications from their campus students
    if (req.user.role === 'campus_poc') {
      const campusStudents = await User.find({ 
        role: 'student', 
        campus: req.user.campus 
      }).select('_id');
      query.student = { $in: campusStudents.map(s => s._id) };
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

// Apply for a job (Students only)
router.post('/', auth, authorize('student'), [
  body('jobId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId, coverLetter, customResponses } = req.body;

    // Check if job exists and is active
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.status !== 'active') {
      return res.status(400).json({ message: 'This job is not accepting applications' });
    }

    if (new Date() > job.applicationDeadline) {
      return res.status(400).json({ message: 'Application deadline has passed' });
    }

    // Validate mandatory custom requirements
    if (job.customRequirements && job.customRequirements.length > 0) {
      const mandatoryRequirements = job.customRequirements.filter(req => req.isMandatory);
      for (const req of mandatoryRequirements) {
        const response = customResponses?.find(r => r.requirement === req.question);
        if (!response || !response.response) {
          return res.status(400).json({ message: `You must agree to: "${req.question}"` });
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
    
    const application = new Application({
      student: req.userId,
      job: jobId,
      resume: student.studentProfile.resume,
      coverLetter,
      customResponses: customResponses || []
    });

    await application.save();

    // Notify coordinators
    const coordinators = await User.find({ role: 'coordinator', isActive: true });
    const notifications = coordinators.map(coordinator => ({
      recipient: coordinator._id,
      type: 'application_update',
      title: 'New Application',
      message: `${student.firstName} ${student.lastName} has applied for ${job.title} at ${job.company.name}`,
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

// Update application status (Coordinators only)
router.put('/:id/status', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { status, feedback } = req.body;
    
    const application = await Application.findById(req.params.id)
      .populate('job', 'title company.name');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = status;
    if (feedback) {
      application.feedback = feedback;
      application.feedbackBy = req.userId;
    }

    // Update placement count if selected
    if (status === 'selected') {
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

      // Update student's placement cycle
      await User.findByIdAndUpdate(application.student, {
        placementCycle: cycle._id,
        placementCycleAssignedAt: new Date(),
        placementCycleAssignedBy: req.userId
      });
    }

    await application.save();

    // Notify student
    await Notification.create({
      recipient: application.student,
      type: status === 'selected' ? 'placement_confirmed' : 'application_update',
      title: 'Application Status Update',
      message: `Your application for ${application.job.title} at ${application.job.company.name} has been ${status}`,
      link: `/applications/${application._id}`,
      relatedEntity: { type: 'application', id: application._id }
    });

    res.json({ message: 'Application status updated', application });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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

    // Update current round
    if (status === 'passed') {
      application.currentRound = round + 1;
      application.status = 'in_progress';
    } else if (status === 'failed') {
      application.status = 'rejected';
    }

    await application.save();

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

    res.json({ message: 'Application withdrawn successfully' });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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
    const headers = ['Student Name', 'Email', 'Enrollment No', 'Department', 'Campus', 'Job Title', 'Company', 'Status', 'Applied Date'];
    const rows = applications.map(app => [
      `${app.student.firstName} ${app.student.lastName}`,
      app.student.email,
      app.student.studentProfile?.enrollmentNumber || '',
      app.student.studentProfile?.department || '',
      app.student.campus?.name || '',
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

module.exports = router;
