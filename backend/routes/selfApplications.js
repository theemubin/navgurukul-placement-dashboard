const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const SelfApplication = require('../models/SelfApplication');
const User = require('../models/User');
const Notification = require('../models/Notification');
const discordService = require('../services/discordService');
const { auth, authorize } = require('../middleware/auth');

// Get all self-applications (filtered by role)
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};

    if (req.user.role === 'student') {
      // Students can only see their own self-applications
      query.student = req.userId;
    } else if (req.user.role === 'campus_poc') {
      // Campus PoCs see self-applications from their managed campuses
      const managedCampuses = req.user.managedCampuses?.length > 0
        ? req.user.managedCampuses
        : (req.user.campus ? [req.user.campus] : []);

      const campusStudents = await User.find({
        role: 'student',
        campus: { $in: managedCampuses }
      }).select('_id');
      query.student = { $in: campusStudents.map(s => s._id) };
    }
    // Coordinators and managers can see all

    if (status) {
      query.status = status;
    }

    const selfApplications = await SelfApplication.find(query)
      .populate('student', 'firstName lastName email studentProfile.currentSchool')
      .populate('verifiedBy', 'firstName lastName')
      .populate('relevantSkills', 'name')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await SelfApplication.countDocuments(query);

    res.json({
      selfApplications,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get self-applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single self-application
router.get('/:id', auth, async (req, res) => {
  try {
    const selfApplication = await SelfApplication.findById(req.params.id)
      .populate('student', 'firstName lastName email campus studentProfile')
      .populate('verifiedBy', 'firstName lastName')
      .populate('relevantSkills', 'name');

    if (!selfApplication) {
      return res.status(404).json({ message: 'Self-application not found' });
    }

    // Authorization check
    if (req.user.role === 'student' && selfApplication.student._id.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(selfApplication);
  } catch (error) {
    console.error('Get self-application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create self-application (Students only)
router.post('/', auth, authorize('student'), [
  body('company.name').trim().notEmpty().withMessage('Company name is required'),
  body('jobTitle').trim().notEmpty().withMessage('Job title is required'),
  body('applicationDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const selfApplicationData = {
      ...req.body,
      student: req.userId,
      status: 'applied'
    };

    const selfApplication = new SelfApplication(selfApplicationData);
    await selfApplication.save();

    // Notify Campus PoC
    const student = await User.findById(req.userId);
    const campusPoCs = await User.find({
      role: 'campus_poc',
      campus: student.campus,
      isActive: true
    });

    const notifications = campusPoCs.map(poc => ({
      recipient: poc._id,
      type: 'self_application',
      title: 'New Self-Application',
      message: `${student.firstName} ${student.lastName} applied to ${req.body.company.name} for ${req.body.jobTitle}`,
      link: `/campus-poc/self-applications/${selfApplication._id}`,
      relatedEntity: { type: 'self_application', id: selfApplication._id }
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    // Trigger Discord Notification
    try {
      const studentWithCampus = await User.findById(req.userId).populate('campus');
      const discordResult = await discordService.sendSelfApplicationNotification(selfApplication, studentWithCampus);
      if (discordResult && !discordResult.error) {
        selfApplication.discordMessageId = discordResult.messageId;
        selfApplication.discordThreadId = discordResult.threadId;
        await selfApplication.save();
      }
    } catch (discordError) {
      console.error('Failed to send self-application notification to Discord:', discordError);
    }

    res.status(201).json(selfApplication);
  } catch (error) {
    console.error('Create self-application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update self-application (Student owner only)
router.put('/:id', auth, authorize('student'), async (req, res) => {
  try {
    const selfApplication = await SelfApplication.findById(req.params.id);

    if (!selfApplication) {
      return res.status(404).json({ message: 'Self-application not found' });
    }

    if (selfApplication.student.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const allowedUpdates = [
      'company', 'jobTitle', 'jobLink', 'jobType', 'salary',
      'applicationMethod', 'status', 'interviewRounds', 'offer',
      'notes', 'referredBy', 'relevantSkills'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        selfApplication[field] = req.body[field];
      }
    });

    await selfApplication.save();

    res.json(selfApplication);
  } catch (error) {
    console.error('Update self-application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update status with notification
router.patch('/:id/status', auth, authorize('student'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const selfApplication = await SelfApplication.findById(req.params.id);

    if (!selfApplication) {
      return res.status(404).json({ message: 'Self-application not found' });
    }

    if (selfApplication.student.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    selfApplication.status = status;
    if (notes) {
      selfApplication.notes = notes;
    }

    await selfApplication.save();

    // Notify Campus PoC on significant status changes
    if (['offer_received', 'offer_accepted', 'offer_declined', 'rejected'].includes(status)) {
      const student = await User.findById(req.userId);
      const campusPoCs = await User.find({
        role: 'campus_poc',
        campus: student.campus,
        isActive: true
      });

      const statusMessages = {
        offer_received: 'received an offer from',
        offer_accepted: 'accepted an offer from',
        offer_declined: 'declined an offer from',
        rejected: 'was rejected by'
      };

      const notifications = campusPoCs.map(poc => ({
        recipient: poc._id,
        type: 'self_application_update',
        title: `Self-Application Update: ${status.replace('_', ' ').toUpperCase()}`,
        message: `${student.firstName} ${student.lastName} ${statusMessages[status]} ${selfApplication.company.name}`,
        link: `/campus-poc/self-applications/${selfApplication._id}`,
        relatedEntity: { type: 'self_application', id: selfApplication._id }
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    // Trigger Discord status update in thread
    try {
      const studentWithCampus = await User.findById(req.userId).populate('campus');
      await discordService.sendSelfApplicationUpdate(selfApplication, studentWithCampus, req.user);
    } catch (discordError) {
      console.error('Failed to send status update to Discord thread:', discordError);
    }

    res.json(selfApplication);
  } catch (error) {
    console.error('Update self-application status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify self-application (Campus PoC only)
router.patch('/:id/verify', auth, authorize('campus_poc', 'coordinator', 'manager'), [
  body('isVerified').isBoolean(),
  body('verificationNotes').optional().trim()
], async (req, res) => {
  try {
    const { isVerified, verificationNotes } = req.body;
    const selfApplication = await SelfApplication.findById(req.params.id)
      .populate('student', 'campus firstName lastName');

    if (!selfApplication) {
      return res.status(404).json({ message: 'Self-application not found' });
    }

    // Campus PoC can only verify their managed campus students
    if (req.user.role === 'campus_poc') {
      const managedCampuses = req.user.managedCampuses?.length > 0
        ? req.user.managedCampuses.map(c => c.toString())
        : (req.user.campus ? [req.user.campus.toString()] : []);

      if (!managedCampuses.includes(selfApplication.student.campus?.toString())) {
        return res.status(403).json({ message: 'Not authorized for this campus' });
      }
    }

    selfApplication.isVerified = isVerified;
    selfApplication.verifiedBy = req.userId;
    selfApplication.verifiedAt = new Date();
    selfApplication.verificationNotes = verificationNotes;

    await selfApplication.save();

    // Notify student
    const notification = new Notification({
      recipient: selfApplication.student._id,
      type: 'self_application_verified',
      title: isVerified ? 'Self-Application Verified!' : 'Self-Application Review',
      message: isVerified
        ? `Your application to ${selfApplication.company.name} has been verified by Campus PoC.`
        : `Your application to ${selfApplication.company.name} needs attention. ${verificationNotes || ''}`,
      link: `/student/self-applications/${selfApplication._id}`,
      relatedEntity: { type: 'self_application', id: selfApplication._id }
    });

    await notification.save();

    res.json(selfApplication);
  } catch (error) {
    console.error('Verify self-application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete self-application
router.delete('/:id', auth, authorize('student'), async (req, res) => {
  try {
    const selfApplication = await SelfApplication.findById(req.params.id);

    if (!selfApplication) {
      return res.status(404).json({ message: 'Self-application not found' });
    }

    if (selfApplication.student.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await selfApplication.deleteOne();

    res.json({ message: 'Self-application deleted successfully' });
  } catch (error) {
    console.error('Delete self-application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get stats for campus (Campus PoC)
router.get('/stats/campus', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    let campusId;
    if (req.user.role === 'campus_poc') {
      campusId = req.user.managedCampuses?.length > 0
        ? req.user.managedCampuses
        : (req.user.campus ? [req.user.campus] : []);
    } else {
      campusId = req.query.campusId || req.user.campus;
    }

    const stats = await SelfApplication.getCampusStats(campusId);
    res.json(stats);
  } catch (error) {
    console.error('Get self-application stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
