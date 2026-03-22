const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const PlacementCycle = require('../models/PlacementCycle');
const User = require('../models/User');
const Application = require('../models/Application');
const { auth, authorize } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: PlacementCycles
 *   description: Placement cycle management for students
 */

// Get all placement cycles (global - visible to all authorized users)
/**
 * @swagger
 * /api/placement-cycles:
 *   get:
 *     summary: Get all placement cycles
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of cycles
 */
router.get('/', auth, authorize('student', 'campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { activeOnly } = req.query;
    let query = {};

    if (activeOnly === 'true') {
      query.isActive = true;
    }

    const cycles = await PlacementCycle.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ year: -1, month: -1 });

    // For students, just return the cycles list
    if (req.user.role === 'student') {
      return res.json(cycles);
    }

    // For POC/Coordinator/Manager, include stats
    // POC sees only their campus stats
    const cyclesWithStats = await Promise.all(cycles.map(async (cycle) => {
      let studentQuery = { role: 'student', placementCycle: cycle._id };

      // POC only sees their campus students
      if (req.user.role === 'campus_poc') {
        studentQuery.campus = req.user.campus;
      } else if (req.query.campus) {
        studentQuery.campus = req.query.campus;
      }

      const studentCount = await User.countDocuments(studentQuery);

      const studentIds = await User.find(studentQuery).select('_id').then(users => users.map(u => u._id));

      const placedCount = await Application.countDocuments({
        student: { $in: studentIds },
        status: 'selected'
      });

      return {
        ...cycle.toJSON(),
        studentCount,
        placedCount
      };
    }));

    res.json(cyclesWithStats);
  } catch (error) {
    console.error('Get placement cycles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/placement-cycles:
 *   post:
 *     summary: Create a new placement cycle
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - month
 *               - year
 *             properties:
 *               month:
 *                 type: integer
 *               year:
 *                 type: integer
 *               description:
 *                 type: string
 *               targetPlacements:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Cycle created
 */
router.post('/',
  auth,
  authorize('manager', 'coordinator', 'campus_poc'),
  [
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('year').isInt({ min: 2020, max: 2050 }).withMessage('Invalid year')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { month, year, description, targetPlacements } = req.body;

      // Generate name from month and year
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const name = `${months[month - 1]} ${year}`;

      // Check if cycle already exists (global - no campus)
      const existing = await PlacementCycle.findOne({ month, year });
      if (existing) {
        return res.status(400).json({ message: 'Placement cycle already exists for this month' });
      }

      const cycle = new PlacementCycle({
        name,
        month,
        year,
        description,
        targetPlacements: targetPlacements || 0,
        createdBy: req.userId
      });

      await cycle.save();

      res.status(201).json(cycle);
    } catch (error) {
      console.error('Create placement cycle error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update placement cycle (Manager only)
/**
 * @swagger
 * /api/placement-cycles/{cycleId}:
 *   put:
 *     summary: Update a placement cycle
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cycle updated
 */
router.put('/:cycleId', auth, authorize('manager', 'coordinator', 'campus_poc'), async (req, res) => {
  try {
    const { status, description, targetPlacements, isActive } = req.body;

    const cycle = await PlacementCycle.findById(req.params.cycleId);
    if (!cycle) {
      return res.status(404).json({ message: 'Placement cycle not found' });
    }

    if (status) cycle.status = status;
    if (description !== undefined) cycle.description = description;
    if (targetPlacements !== undefined) cycle.targetPlacements = targetPlacements;
    if (isActive !== undefined) cycle.isActive = isActive;

    await cycle.save();

    res.json(cycle);
  } catch (error) {
    console.error('Update placement cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete placement cycle (Manager only)
/**
 * @swagger
 * /api/placement-cycles/{cycleId}:
 *   delete:
 *     summary: Delete a placement cycle
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cycle deleted
 */
router.delete('/:cycleId', auth, authorize('manager'), async (req, res) => {
  try {
    const cycle = await PlacementCycle.findById(req.params.cycleId);
    if (!cycle) {
      return res.status(404).json({ message: 'Placement cycle not found' });
    }

    // Check if any students are assigned to this cycle
    const assignedStudents = await User.countDocuments({ placementCycle: cycle._id });
    if (assignedStudents > 0) {
      return res.status(400).json({
        message: `Cannot delete cycle with ${assignedStudents} assigned students. Remove students first.`
      });
    }

    await PlacementCycle.findByIdAndDelete(req.params.cycleId);
    res.json({ message: 'Placement cycle deleted' });
  } catch (error) {
    console.error('Delete placement cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign students to a placement cycle (POC for their campus, Coordinator/Manager for all)
/**
 * @swagger
 * /api/placement-cycles/{cycleId}/students:
 *   post:
 *     summary: Assign students to a placement cycle
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentIds
 *             properties:
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Students assigned
 */
router.post('/:cycleId/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { studentIds } = req.body;

    const cycle = await PlacementCycle.findById(req.params.cycleId);
    if (!cycle) {
      return res.status(404).json({ message: 'Placement cycle not found' });
    }

    // Build student query - POC can only assign their managed campus students
    let studentQuery = { _id: { $in: studentIds }, role: 'student' };
    if (req.user.role === 'campus_poc') {
      const campusIds = Array.from(new Set([
        req.user.campus?.toString(),
        ...(req.user.managedCampuses?.map(c => c.toString()) || [])
      ])).filter(Boolean);
      studentQuery.campus = { $in: campusIds };
    }

    // Update students
    const result = await User.updateMany(
      studentQuery,
      {
        placementCycle: cycle._id,
        placementCycleAssignedAt: new Date(),
        placementCycleAssignedBy: req.userId
      }
    );

    res.json({ message: `${result.modifiedCount} students assigned to cycle`, count: result.modifiedCount });
  } catch (error) {
    console.error('Assign students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove students from a placement cycle
/**
 * @swagger
 * /api/placement-cycles/{cycleId}/students:
 *   delete:
 *     summary: Remove students from a placement cycle
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentIds
 *             properties:
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Students removed
 */
router.delete('/:cycleId/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { studentIds } = req.body;

    const cycle = await PlacementCycle.findById(req.params.cycleId);
    if (!cycle) {
      return res.status(404).json({ message: 'Placement cycle not found' });
    }

    // Build student query - POC can only remove their managed campus students
    let studentQuery = { _id: { $in: studentIds }, placementCycle: cycle._id };
    if (req.user.role === 'campus_poc') {
      const campusIds = Array.from(new Set([
        req.user.campus?.toString(),
        ...(req.user.managedCampuses?.map(c => c.toString()) || [])
      ])).filter(Boolean);
      studentQuery.campus = { $in: campusIds };
    }

    await User.updateMany(
      studentQuery,
      {
        $unset: {
          placementCycle: 1,
          placementCycleAssignedAt: 1,
          placementCycleAssignedBy: 1
        }
      }
    );

    res.json({ message: 'Students removed from cycle' });
  } catch (error) {
    console.error('Remove students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Auto-release students from expired cycles (month has ended, not placed/dropout)
router.post('/release-expired', auth, authorize('manager', 'coordinator', 'campus_poc'), async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    // Find all cycles whose month/year is in the PAST and not yet completed
    const expiredCycles = await PlacementCycle.find({
      $or: [
        { year: { $lt: currentYear } },
        { year: currentYear, month: { $lt: currentMonth } }
      ],
      status: { $ne: 'completed' }
    });

    let totalReleased = 0;
    const results = [];

    for (const cycle of expiredCycles) {
      // Simple query: students in this cycle who are NOT placed or dropout
      const studentsToRelease = await User.find({
        placementCycle: cycle._id,
        role: 'student',
        'studentProfile.currentStatus': {
          $nin: ['Placed', 'placed', 'Dropout', 'DropOut', 'dropout', 'Intern (Out Campus)']
        }
      }).select('_id');

      const releaseIds = studentsToRelease.map(s => s._id);

      // Mark cycle as completed (separate from arrayFilters update)
      await PlacementCycle.updateOne({ _id: cycle._id }, { $set: { status: 'completed' } });

      if (releaseIds.length > 0) {
        // Update snapshot statuses for released students (separate operation)
        await PlacementCycle.updateOne(
          { _id: cycle._id },
          { $set: { 'snapshotStudents.$[elem].status': 'released' } },
          { arrayFilters: [{ 'elem.student': { $in: releaseIds } }] }
        );

        // Unset placementCycle on released students
        await User.updateMany(
          { _id: { $in: releaseIds } },
          {
            $unset: {
              placementCycle: 1,
              placementCycleAssignedAt: 1,
              placementCycleAssignedBy: 1
            }
          }
        );

        totalReleased += releaseIds.length;
      }
      results.push({ cycle: cycle.name, released: releaseIds.length, marked: 'completed' });
    }

    res.json({
      message: totalReleased > 0
        ? `Released ${totalReleased} students from ${results.length} expired cycle(s)`
        : `No students to release. ${results.length} expired cycle(s) marked completed.`,
      results
    });
  } catch (error) {
    console.error('Release expired error:', error);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
});



// Get unassigned students (POC sees their campus, others can filter)
/**
 * @swagger
 * /api/placement-cycles/unassigned/students:
 *   get:
 *     summary: Get students not yet assigned to any cycle
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: campus
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of unassigned students
 */
router.get('/unassigned/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    let query = {
      role: 'student',
      $or: [
        { placementCycle: null },
        { placementCycle: { $exists: false } }
      ]
    };

    // POC only sees their managed campus students
    if (req.user.role === 'campus_poc') {
      const campusIds = Array.from(new Set([
        req.user.campus?.toString(),
        ...(req.user.managedCampuses?.map(c => c.toString()) || [])
      ])).filter(Boolean);
      query.campus = { $in: campusIds };
    } else if (req.query.campus) {
      query.campus = req.query.campus;
    }

    const students = await User.find(query)
      .select('-password')
      .populate('campus', 'name code');

    res.json(students);
  } catch (error) {
    console.error('Get unassigned students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get students in a placement cycle (with campus filter for POC)
/**
 * @swagger
 * /api/placement-cycles/{cycleId}/students:
 *   get:
 *     summary: Get students in a specific placement cycle
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: campus
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of students in cycle
 */
router.get('/:cycleId/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const cycle = await PlacementCycle.findById(req.params.cycleId);
    if (!cycle) {
      return res.status(404).json({ message: 'Placement cycle not found' });
    }

    let studentQuery = { role: 'student', placementCycle: cycle._id };

    // POC only sees their managed campus students
    if (req.user.role === 'campus_poc') {
      const campusIds = Array.from(new Set([
        req.user.campus?.toString(),
        ...(req.user.managedCampuses?.map(c => c.toString()) || [])
      ])).filter(Boolean);
      studentQuery.campus = { $in: campusIds };
    } else if (req.query.campus) {
      studentQuery.campus = req.query.campus;
    }

    const students = await User.find(studentQuery)
      .select('-password')
      .populate('campus', 'name code');

    // Get application stats for each student
    const studentsWithStats = await Promise.all(students.map(async (student) => {
      const applications = await Application.find({ student: student._id })
        .populate('job', 'title company.name');

      const placed = applications.find(a => a.status === 'selected');

      return {
        ...student.toJSON(),
        applicationCount: applications.length,
        placementStatus: placed ? 'placed' : 'not_placed',
        placedCompany: placed ? placed.job?.company?.name : null
      };
    }));

    res.json(studentsWithStats);
  } catch (error) {
    console.error('Get cycle students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Student can select their own placement cycle
/**
 * @swagger
 * /api/placement-cycles/my-cycle:
 *   put:
 *     summary: Update own placement cycle (for students)
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cycleId
 *             properties:
 *               cycleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cycle updated and profile submitted for approval
 */
router.put('/my-cycle', auth, authorize('student'), async (req, res) => {
  try {
    console.log(`Update my-cycle request from user ${req.userId} role=${req.user?.role}`);
    const { cycleId } = req.body;

    const cycle = await PlacementCycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({ message: 'Placement cycle not found' });
    }

    // Business rule: students may change their placement cycle only if the target cycle is not 'active'.
    // This prevents selecting a cycle that is already 'active'.
    if (cycle.status === 'active') {
      return res.status(400).json({ message: 'Cannot change to an active placement cycle. Please contact your Campus POC.' });
    }

    // Update student placement cycle and mark for approval (reuse profile submission flow)
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.placementCycle = cycle._id;
    user.placementCycleAssignedAt = new Date();
    user.placementCycleAssignedBy = req.userId;

    // Trigger profile re-approval flow: mark profile as pending approval and clear previous approval
    user.studentProfile.profileStatus = 'pending_approval';
    user.studentProfile.lastSubmittedAt = new Date();
    user.studentProfile.revisionNotes = '';

    await user.save();

    // Notify Campus POCs who manage this campus
    const campusPocs = await User.find({
      role: 'campus_poc',
      $or: [
        { campus: user.campus },
        { managedCampuses: user.campus }
      ]
    });
    const Notification = require('../models/Notification');
    for (const poc of campusPocs) {
      await Notification.create({
        recipient: poc._id,
        type: 'profile_approval_needed',
        title: 'Profile Approval Needed',
        message: `${user.firstName} ${user.lastName} changed their placement cycle and submitted profile for approval.`,
        link: `/students/${user._id}`,
        relatedEntity: { type: 'user', id: user._id }
      });
    }

    res.json({ message: 'Placement cycle updated and profile submitted for approval', cycle });
  } catch (error) {
    console.error('Update my cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update student's cycle to current month on successful placement
/**
 * @swagger
 * /api/placement-cycles/student/{studentId}/placement-success:
 *   put:
 *     summary: Auto-assign placed student to current cycle
 *     tags: [PlacementCycles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student cycle updated
 */
router.put('/student/:studentId/placement-success', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find or create current month's cycle
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

    await User.findByIdAndUpdate(studentId, {
      placementCycle: cycle._id,
      placementCycleAssignedAt: new Date(),
      placementCycleAssignedBy: req.userId
    });

    res.json({ message: 'Student cycle updated to current month', cycle });
  } catch (error) {
    console.error('Update placement success cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
