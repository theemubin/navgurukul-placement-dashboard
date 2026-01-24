const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { JobReadinessConfig, StudentJobReadiness, DEFAULT_CRITERIA } = require('../models/JobReadiness');
const User = require('../models/User');
const Notification = require('../models/Notification');
const upload = require('../middleware/upload');
const { auth, authorize, sameCampus } = require('../middleware/auth');
// ...existing code...
// Add a new criterion to the config (PoC/Manager)
router.post('/config/:configId/criteria', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { configId } = req.params;
    const { name, description, type, pocCommentRequired, pocCommentTemplate, pocRatingRequired, pocRatingScale, link, category, isMandatory, numericTarget, weight } = req.body;
    console.log('Adding criterion:', { name, type, pocCommentRequired, pocRatingRequired, category }); // Debug log
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const config = await JobReadinessConfig.findById(configId);
    if (!config) return res.status(404).json({ message: 'Config not found' });
    const criteriaId = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    config.criteria.push({
      criteriaId,
      name,
      description,
      type: type || 'answer',
      pocCommentRequired: pocCommentRequired || false,
      pocCommentTemplate,
      pocRatingRequired: pocRatingRequired || false,
      pocRatingScale: pocRatingScale || 5,
      link,
      category: category || 'other',
      isMandatory: isMandatory !== undefined ? isMandatory : true,
      numericTarget,
      weight: weight || 1
    });
    console.log('Pushed criterion:', config.criteria[config.criteria.length - 1]);
    config.updatedBy = req.userId;
    console.log('Saving config...');
    await config.save();
    console.log('Config saved successfully');
    res.json(config);
  } catch (error) {
    console.error('Add criterion error:', error);
    console.error('Error details:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', details: error.errors });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit a criterion in the config (PoC/Manager)
router.put('/config/:configId/criteria/:criteriaId', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { configId, criteriaId } = req.params;
    const { name, description, type, pocCommentRequired, pocCommentTemplate, pocRatingRequired, pocRatingScale, link, category, isMandatory, numericTarget, weight } = req.body;
    const config = await JobReadinessConfig.findById(configId);
    if (!config) return res.status(404).json({ message: 'Config not found' });
    const criterion = config.criteria.find(c => c.criteriaId === criteriaId);
    if (!criterion) return res.status(404).json({ message: 'Criterion not found' });
    if (name) criterion.name = name;
    if (description !== undefined) criterion.description = description;
    if (type !== undefined) criterion.type = type;
    if (pocCommentRequired !== undefined) criterion.pocCommentRequired = pocCommentRequired;
    if (pocCommentTemplate !== undefined) criterion.pocCommentTemplate = pocCommentTemplate;
    if (pocRatingRequired !== undefined) criterion.pocRatingRequired = pocRatingRequired;
    if (pocRatingScale !== undefined) criterion.pocRatingScale = pocRatingScale;
    if (link !== undefined) criterion.link = link;
    if (category !== undefined) criterion.category = category;
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
      // Ensure initial readiness is calculated and stored
      await readiness.calculateReadiness();
      await readiness.save();
    } else {
      // Recalculate readiness on each read to ensure latest percentage/status
      try {
        await readiness.calculateReadiness();
        await readiness.save();
      } catch (e) {
        console.error('Failed to recalculate readiness on /my-status:', e);
      }
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

// --- Manager/PoC: Get readiness for a specific student ---
router.get('/student/:studentId', auth, authorize('campus_poc', 'coordinator', 'manager'), sameCampus, async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    let readiness = await StudentJobReadiness.findOne({ student: studentId });
    if (!readiness) {
      // Initialize if missing
      const config = await JobReadinessConfig.findOne({
        school: student.studentProfile?.currentSchool,
        $or: [{ campus: student.campus }, { campus: null }],
        isActive: true
      }).sort({ campus: -1 });

      const initialStatus = config?.criteria?.map(c => ({ criteriaId: c.criteriaId, status: 'not_started' })) || [];
      readiness = new StudentJobReadiness({ student: studentId, school: student.studentProfile?.currentSchool, campus: student.campus, criteriaStatus: initialStatus });
      // Calculate initial readiness and persist
      await readiness.calculateReadiness();
      await readiness.save();
    } else {
      // Ensure the returned readiness is up-to-date
      try {
        await readiness.calculateReadiness();
        await readiness.save();
      } catch (e) {
        console.error('Failed to recalculate readiness on /student/:studentId:', e);
      }
    }

    const config = await JobReadinessConfig.findOne({
      school: readiness.school,
      $or: [{ campus: readiness.campus }, { campus: null }],
      isActive: true
    }).sort({ campus: -1 });

    res.json({ readiness, config: config?.criteria || [], defaults: DEFAULT_CRITERIA });
  } catch (error) {
    console.error('Get student readiness error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Manager/PoC: Update readiness for a specific student ---
router.put('/student/:studentId', auth, authorize('campus_poc', 'coordinator', 'manager'), sameCampus, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { criteriaStatus } = req.body; // expect array of { criteriaId, status, pocComment, pocRating, proofUrl }

    const readiness = await StudentJobReadiness.findOne({ student: studentId });
    if (!readiness) return res.status(404).json({ message: 'Readiness record not found' });

    // Merge incoming statuses
    for (const incoming of (criteriaStatus || [])) {
      const existing = readiness.criteriaStatus.find(c => c.criteriaId === incoming.criteriaId);
      if (existing) {
        if (incoming.status) existing.status = incoming.status;
        if (incoming.proofUrl !== undefined) existing.proofUrl = incoming.proofUrl;
        if (incoming.pocComment !== undefined) {
          existing.pocComment = incoming.pocComment;
          existing.pocCommentedBy = req.userId;
          existing.pocCommentedAt = new Date();
        }
        if (incoming.pocRating !== undefined) {
          existing.pocRating = incoming.pocRating;
          existing.pocRatedBy = req.userId;
          existing.pocRatedAt = new Date();
        }
        if ((incoming.status === 'verified' || incoming.status === 'completed') && !existing.verifiedAt) {
          existing.verifiedAt = new Date();
          existing.verifiedBy = req.userId;
        }
        existing.updatedAt = new Date();
      } else {
        // If criterion not present, push it
        readiness.criteriaStatus.push({
          criteriaId: incoming.criteriaId,
          status: incoming.status || 'not_started',
          proofUrl: incoming.proofUrl,
          pocComment: incoming.pocComment,
          pocCommentedBy: incoming.pocComment ? req.userId : undefined,
          pocCommentedAt: incoming.pocComment ? new Date() : undefined,
          pocRating: incoming.pocRating,
          pocRatedBy: incoming.pocRating ? req.userId : undefined,
          pocRatedAt: incoming.pocRating ? new Date() : undefined,
          updatedAt: new Date(),
        });
      }
    }

    // Recalculate readiness
    const before = JSON.parse(JSON.stringify(readiness));
    await readiness.calculateReadiness();
    await readiness.save();

    // Log readiness changes
    try {
      const UserChangeLog = require('../models/UserChangeLog');
      const diffs = [];
      // Compare criteria statuses
      const beforeMap = new Map((before.criteriaStatus || []).map(c => [c.criteriaId, c]));
      for (const now of (readiness.criteriaStatus || [])) {
        const b = beforeMap.get(now.criteriaId) || {};
        if (b.status !== now.status) diffs.push({ path: `readiness.${now.criteriaId}.status`, oldValue: b.status, newValue: now.status });
        if ((b.pocComment || '') !== (now.pocComment || '')) diffs.push({ path: `readiness.${now.criteriaId}.pocComment`, oldValue: b.pocComment, newValue: now.pocComment });
        if ((b.pocRating || '') !== (now.pocRating || '')) diffs.push({ path: `readiness.${now.criteriaId}.pocRating`, oldValue: b.pocRating, newValue: now.pocRating });
      }
      if (diffs.length > 0) {
        await UserChangeLog.create({ user: readiness.student, changedBy: req.userId, changeType: 'readiness_change', fieldChanges: diffs });
      }
    } catch (logErr) {
      console.error('Failed to write readiness change log:', logErr);
    }

    res.json({ message: 'Readiness updated', readiness });
  } catch (error) {
    console.error('Update student readiness error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update my criterion status (Student)
router.patch('/my-status/:criteriaId', auth, authorize('student'), upload.single('proofFile'), [
  body('completed').optional().isBoolean(),
  body('status').optional().isString(),
  body('selfReportedValue').optional(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const { criteriaId } = req.params;
    // Multer may parse multipart/form-data and place values as strings
    const raw = req.body || {};
    const completed = raw.completed === 'true' || raw.completed === true;
    const status = raw.status;
    let selfReportedValue;
    if (raw.selfReportedValue !== undefined) {
      const parsed = Number(raw.selfReportedValue);
      selfReportedValue = !isNaN(parsed) ? parsed : undefined;
    } else {
      selfReportedValue = undefined;
    }
    const notes = raw.notes;

    let readiness = await StudentJobReadiness.findOne({ student: req.userId });

    if (!readiness) {
      return res.status(404).json({ message: 'Please access your readiness status first' });
    }

    // Find or add criterion status
    let criterionIndex = readiness.criteriaStatus.findIndex(c => c.criteriaId === criteriaId);

    const newStatus = status || (completed ? 'completed' : 'not_started');

    const fileProofPath = req.file ? req.file.path : undefined;

    if (criterionIndex === -1) {
      readiness.criteriaStatus.push({
        criteriaId,
        status: newStatus,
        selfReportedValue,
        notes,
        proofUrl: fileProofPath,
        completedAt: completed ? new Date() : null,
        updatedAt: new Date()
      });
    } else {
      readiness.criteriaStatus[criterionIndex] = {
        ...readiness.criteriaStatus[criterionIndex],
        criteriaId: criteriaId, // Ensure criteriaId is preserved
        status: newStatus,
        selfReportedValue: selfReportedValue !== undefined ? selfReportedValue : readiness.criteriaStatus[criterionIndex].selfReportedValue,
        notes: notes !== undefined ? notes : readiness.criteriaStatus[criterionIndex].notes,
        proofUrl: fileProofPath || readiness.criteriaStatus[criterionIndex].proofUrl,
        completedAt: completed ? new Date() : readiness.criteriaStatus[criterionIndex].completedAt,
        updatedAt: new Date()
      };
    }

    // Recalculate readiness percentage
    await readiness.calculateReadiness();
    await readiness.save();

    res.json(readiness);
  } catch (error) {
    console.error('Update my criterion error:', error);
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ message: error.message || 'Server error', stack: error.stack });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get campus students' readiness (Campus PoC)
router.get('/campus-students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { school, isJobReady, page = 1, limit = 20 } = req.query;

    let query = {};

    // Campus PoC sees only their managed campuses
    if (req.user.role === 'campus_poc') {
      const managedCampuses = req.user.managedCampuses?.length > 0
        ? req.user.managedCampuses
        : (req.user.campus ? [req.user.campus] : []);

      if (managedCampuses.length > 0) {
        query.campus = { $in: managedCampuses };
      }
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
      const managedCampuses = req.user.managedCampuses?.length > 0
        ? req.user.managedCampuses.map(c => c.toString())
        : (req.user.campus ? [req.user.campus.toString()] : []);

      const studentCampus = readiness.campus?.toString();
      if (studentCampus && !managedCampuses.includes(studentCampus)) {
        return res.status(403).json({ message: 'Not authorized for this student\'s campus' });
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
      const managedCampuses = req.user.managedCampuses?.length > 0
        ? req.user.managedCampuses.map(id => id.toString())
        : (req.user.campus ? [req.user.campus.toString()] : []);

      if (readiness.campus?.toString() && !managedCampuses.includes(readiness.campus.toString())) {
        return res.status(403).json({ message: 'Not authorized for this student\'s campus' });
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

// Add PoC comment to a student's criterion (Campus PoC)
router.post('/student/:studentId/comment/:criteriaId', auth, authorize('campus_poc', 'coordinator', 'manager'), sameCampus, [
  body('comment').trim().notEmpty()
], async (req, res) => {
  try {
    const { studentId, criteriaId } = req.params;
    const { comment } = req.body;

    const readiness = await StudentJobReadiness.findOne({ student: studentId });
    if (!readiness) return res.status(404).json({ message: 'Student job readiness not found' });

    const criterionStatus = readiness.criteriaStatus.find(cs => cs.criteriaId === criteriaId);
    if (!criterionStatus) return res.status(404).json({ message: 'Criterion not found' });

    criterionStatus.pocComment = comment;
    criterionStatus.pocCommentedBy = req.userId;
    criterionStatus.pocCommentedAt = new Date();

    await readiness.save();

    // Create notification for student
    const notification = new Notification({
      recipient: studentId,
      type: 'job_readiness_comment',
      title: 'New Feedback on Job Readiness',
      message: `Your PoC has added feedback on "${criteriaId.replace(/_/g, ' ')}".`,
      link: '/student/job-readiness',
      relatedEntity: { type: 'job_readiness', id: readiness._id }
    });
    await notification.save();

    res.json(readiness);
  } catch (error) {
    console.error('Add PoC comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add PoC rating to a student's criterion (Campus PoC)
router.post('/student/:studentId/rate/:criteriaId', auth, authorize('campus_poc', 'coordinator', 'manager'), sameCampus, [
  body('rating').isInt({ min: 1, max: 10 })
], async (req, res) => {
  try {
    const { studentId, criteriaId } = req.params;
    const { rating } = req.body;

    const readiness = await StudentJobReadiness.findOne({ student: studentId });
    if (!readiness) return res.status(404).json({ message: 'Student job readiness not found' });

    const criterionStatus = readiness.criteriaStatus.find(cs => cs.criteriaId === criteriaId);
    if (!criterionStatus) return res.status(404).json({ message: 'Criterion not found' });

    criterionStatus.pocRating = rating;
    criterionStatus.pocRatedBy = req.userId;
    criterionStatus.pocRatedAt = new Date();

    await readiness.save();

    // Create notification for student
    const notification = new Notification({
      recipient: studentId,
      type: 'job_readiness_rating',
      title: 'New Rating on Job Readiness',
      message: `Your PoC has rated your "${criteriaId.replace(/_/g, ' ')}" as ${rating}/10.`,
      link: '/student/job-readiness',
      relatedEntity: { type: 'job_readiness', id: readiness._id }
    });
    await notification.save();

    res.json(readiness);
  } catch (error) {
    console.error('Add PoC rating error:', error);
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
      const managedCampuses = req.user.managedCampuses?.length > 0
        ? req.user.managedCampuses.map(id => id.toString())
        : (req.user.campus ? [req.user.campus.toString()] : []);

      if (readiness.campus?.toString() && !managedCampuses.includes(readiness.campus.toString())) {
        return res.status(403).json({ message: 'Not authorized for this student\'s campus' });
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
