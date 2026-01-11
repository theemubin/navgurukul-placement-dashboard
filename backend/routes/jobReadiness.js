const express = require('express');
const router = express.Router();
// ...existing code...
// Add a new criterion to the config (PoC/Manager)
router.post('/config/:configId/criteria', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { configId } = req.params;
    const { name, description, link, comment, category, isMandatory, numericTarget, weight } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const config = await JobReadinessConfig.findById(configId);
    if (!config) return res.status(404).json({ message: 'Config not found' });
    const criteriaId = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    config.criteria.push({
      criteriaId,
      name,
      description,
      link,
      comment,
      category,
      isMandatory: isMandatory !== undefined ? isMandatory : true,
      numericTarget,
      weight: weight || 1
    });
    config.updatedBy = req.userId;
    await config.save();
    res.json(config);
  } catch (error) {
    console.error('Add criterion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit a criterion in the config (PoC/Manager)
router.put('/config/:configId/criteria/:criteriaId', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { configId, criteriaId } = req.params;
    const { name, description, link, comment, category, isMandatory, numericTarget, weight } = req.body;
    const config = await JobReadinessConfig.findById(configId);
    if (!config) return res.status(404).json({ message: 'Config not found' });
    const criterion = config.criteria.find(c => c.criteriaId === criteriaId);
    if (!criterion) return res.status(404).json({ message: 'Criterion not found' });
    if (name) criterion.name = name;
    if (description !== undefined) criterion.description = description;
    if (link !== undefined) criterion.link = link;
    if (comment !== undefined) criterion.comment = comment;
    if (category) criterion.category = category;
    if (isMandatory !== undefined) criterion.isMandatory = isMandatory;
    if (numericTarget !== undefined) criterion.numericTarget = numericTarget;
    if (weight !== undefined) criterion.weight = weight;
    config.updatedBy = req.userId;
    await config.save();
    res.json(config);
  } catch (error) {
    console.error('Edit criterion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a criterion from the config (PoC/Manager)
router.delete('/config/:configId/criteria/:criteriaId', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { configId, criteriaId } = req.params;
    const config = await JobReadinessConfig.findById(configId);
    if (!config) return res.status(404).json({ message: 'Config not found' });
    config.criteria = config.criteria.filter(c => c.criteriaId !== criteriaId);
    config.updatedBy = req.userId;
    await config.save();
    res.json(config);
  } catch (error) {
    console.error('Delete criterion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { JobReadinessConfig, StudentJobReadiness, DEFAULT_CRITERIA } = require('../models/JobReadiness');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');

// === Config Routes (for PoC/Manager) ===

// Get readiness config for a school/campus
router.get('/config', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { school, campus } = req.query;
    
    let query = {};
    if (school) query.school = school;
    if (campus) query.campus = campus;
    
    // For campus PoC, default to their campus
    if (req.user.role === 'campus_poc' && !campus) {
      query.campus = req.user.campus;
    }

    const configs = await JobReadinessConfig.find(query)
      .populate('campus', 'name')
      .populate('createdBy', 'firstName lastName')
      .sort({ school: 1 });

    res.json(configs);
  } catch (error) {
    console.error('Get readiness config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get default criteria options
router.get('/config/defaults', auth, async (req, res) => {
  res.json(DEFAULT_CRITERIA);
});

// Create/Update readiness config
router.post('/config', auth, authorize('campus_poc', 'coordinator', 'manager'), [
  body('school').notEmpty().withMessage('School is required'),
  body('criteria').isArray().withMessage('Criteria must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { school, campus, criteria } = req.body;

    // Check if config already exists
    let config = await JobReadinessConfig.findOne({ school, campus: campus || null });

    if (config) {
      // Update existing
      config.criteria = criteria;
      config.updatedBy = req.userId;
      await config.save();
    } else {
      // Create new
      config = new JobReadinessConfig({
        school,
        campus: campus || null,
        criteria,
        createdBy: req.userId
      });
      await config.save();
    }

    res.json(config);
  } catch (error) {
    console.error('Save readiness config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// === Student Progress Routes ===

// Get my readiness status (Student)
router.get('/my-status', auth, authorize('student'), async (req, res) => {
  try {
    const student = await User.findById(req.userId);
    const school = student.studentProfile?.currentSchool;

    if (!school) {
      return res.status(400).json({ message: 'Please set your current school in your profile first' });
    }

    // Find or create student readiness record
    let readiness = await StudentJobReadiness.findOne({ student: req.userId });

    if (!readiness) {
      // Get config for student's school/campus
      const config = await JobReadinessConfig.findOne({
        school,
        $or: [{ campus: student.campus }, { campus: null }],
        isActive: true
      }).sort({ campus: -1 }); // Prefer campus-specific

      // Initialize with empty status for each criterion
      const initialStatus = config?.criteria?.map(c => ({
        criteriaId: c.criteriaId,
        status: 'not_started'
      })) || [];

      readiness = new StudentJobReadiness({
        student: req.userId,
        school,
        campus: student.campus,
        criteriaStatus: initialStatus
      });
      await readiness.save();
    }

    // Get config to include criterion details
    const config = await JobReadinessConfig.findOne({
      school: readiness.school,
      $or: [{ campus: readiness.campus }, { campus: null }],
      isActive: true
    }).sort({ campus: -1 });

    res.json({
      readiness,
      config: config?.criteria || [],
      defaults: DEFAULT_CRITERIA
    });
  } catch (error) {
    console.error('Get my readiness error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update my criterion status (Student)
router.patch('/my-status/:criteriaId', auth, authorize('student'), [
  body('status').isIn(['not_started', 'in_progress', 'completed']),
  body('selfReportedValue').optional().isNumeric(),
  body('proofUrl').optional().trim()
], async (req, res) => {
  try {
    const { criteriaId } = req.params;
    const { status, selfReportedValue, proofUrl } = req.body;

    let readiness = await StudentJobReadiness.findOne({ student: req.userId });

    if (!readiness) {
      return res.status(404).json({ message: 'Please access your readiness status first' });
    }

    // Find or add criterion status
    let criterionIndex = readiness.criteriaStatus.findIndex(c => c.criteriaId === criteriaId);
    
    if (criterionIndex === -1) {
      readiness.criteriaStatus.push({
        criteriaId,
        status,
        selfReportedValue,
        proofUrl,
        updatedAt: new Date()
      });
    } else {
      readiness.criteriaStatus[criterionIndex] = {
        ...readiness.criteriaStatus[criterionIndex],
        status,
        selfReportedValue: selfReportedValue ?? readiness.criteriaStatus[criterionIndex].selfReportedValue,
        proofUrl: proofUrl ?? readiness.criteriaStatus[criterionIndex].proofUrl,
        completedAt: status === 'completed' ? new Date() : readiness.criteriaStatus[criterionIndex].completedAt,
        updatedAt: new Date()
      };
    }

    // Recalculate readiness percentage
    await readiness.calculateReadiness();
    await readiness.save();

    res.json(readiness);
  } catch (error) {
    console.error('Update my criterion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get campus students' readiness (Campus PoC)
router.get('/campus-students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { school, isJobReady, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    // Campus PoC sees only their campus
    if (req.user.role === 'campus_poc') {
      query.campus = req.user.campus;
    }

    if (school) query.school = school;
    if (isJobReady !== undefined) query.isJobReady = isJobReady === 'true';

    const readinessRecords = await StudentJobReadiness.find(query)
      .populate('student', 'firstName lastName email studentProfile.currentSchool studentProfile.currentModule')
      .populate('approvedBy', 'firstName lastName')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ readinessPercentage: -1 });

    const total = await StudentJobReadiness.countDocuments(query);

    res.json({
      records: readinessRecords,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get campus students readiness error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single student's readiness detail (Campus PoC)
router.get('/student/:studentId', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const readiness = await StudentJobReadiness.findOne({ student: req.params.studentId })
      .populate('student', 'firstName lastName email campus studentProfile')
      .populate('approvedBy', 'firstName lastName');

    if (!readiness) {
      return res.status(404).json({ message: 'Student readiness record not found' });
    }

    // Authorization check for campus PoC
    if (req.user.role === 'campus_poc') {
      const student = await User.findById(req.params.studentId);
      if (student.campus?.toString() !== req.user.campus?.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    // Get config for this student
    const config = await JobReadinessConfig.findOne({
      school: readiness.school,
      $or: [{ campus: readiness.campus }, { campus: null }],
      isActive: true
    }).sort({ campus: -1 });

    res.json({
      readiness,
      config: config?.criteria || []
    });
  } catch (error) {
    console.error('Get student readiness error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify criterion (Campus PoC)
router.patch('/student/:studentId/verify/:criteriaId', auth, authorize('campus_poc', 'coordinator', 'manager'), [
  body('verified').isBoolean(),
  body('verificationNotes').optional().trim()
], async (req, res) => {
  try {
    const { studentId, criteriaId } = req.params;
    const { verified, verificationNotes } = req.body;

    const readiness = await StudentJobReadiness.findOne({ student: studentId });

    if (!readiness) {
      return res.status(404).json({ message: 'Student readiness record not found' });
    }

    // Authorization check
    if (req.user.role === 'campus_poc') {
      if (readiness.campus?.toString() !== req.user.campus?.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    // Find criterion
    const criterionIndex = readiness.criteriaStatus.findIndex(c => c.criteriaId === criteriaId);
    
    if (criterionIndex === -1) {
      return res.status(404).json({ message: 'Criterion not found' });
    }

    readiness.criteriaStatus[criterionIndex].status = verified ? 'verified' : 'completed';
    readiness.criteriaStatus[criterionIndex].verifiedBy = req.userId;
    readiness.criteriaStatus[criterionIndex].verifiedAt = new Date();
    readiness.criteriaStatus[criterionIndex].verificationNotes = verificationNotes;

    // Recalculate and save
    await readiness.calculateReadiness();
    await readiness.save();

    // Notify student
    const student = await User.findById(studentId);
    const notification = new Notification({
      recipient: studentId,
      type: 'criterion_verified',
      title: verified ? 'Readiness Criterion Verified!' : 'Readiness Update',
      message: verified 
        ? `Your "${criteriaId}" criterion has been verified.`
        : `Your "${criteriaId}" criterion needs review. ${verificationNotes || ''}`,
      link: '/student/job-readiness',
      relatedEntity: { type: 'job_readiness', id: readiness._id }
    });
    await notification.save();

    res.json(readiness);
  } catch (error) {
    console.error('Verify criterion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve student as job ready (Campus PoC)
router.patch('/student/:studentId/approve', auth, authorize('campus_poc', 'coordinator', 'manager'), [
  body('approved').isBoolean(),
  body('approvalNotes').optional().trim()
], async (req, res) => {
  try {
    const { studentId } = req.params;
    const { approved, approvalNotes } = req.body;

    const readiness = await StudentJobReadiness.findOne({ student: studentId });

    if (!readiness) {
      return res.status(404).json({ message: 'Student readiness record not found' });
    }

    // Authorization check
    if (req.user.role === 'campus_poc') {
      if (readiness.campus?.toString() !== req.user.campus?.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    readiness.approvedAsJobReady = approved;
    readiness.approvedBy = req.userId;
    readiness.approvedAt = new Date();
    readiness.approvalNotes = approvalNotes;

    await readiness.save();

    // Notify student
    const notification = new Notification({
      recipient: studentId,
      type: approved ? 'job_ready_approved' : 'job_ready_pending',
      title: approved ? '🎉 You are Job Ready!' : 'Job Readiness Update',
      message: approved 
        ? 'Congratulations! Your Campus PoC has approved you as job ready. You can now apply for jobs!'
        : `Your job readiness status needs attention. ${approvalNotes || ''}`,
      link: '/student/job-readiness',
      relatedEntity: { type: 'job_readiness', id: readiness._id }
    });
    await notification.save();

    res.json(readiness);
  } catch (error) {
    console.error('Approve job ready error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
