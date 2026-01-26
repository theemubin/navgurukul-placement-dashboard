const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const PlacementCycle = require('../models/PlacementCycle');
const User = require('../models/User');
const Application = require('../models/Application');
const { auth, authorize } = require('../middleware/auth');

// Get all placement cycles (global - visible to all authorized users)
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

// Create a new placement cycle (Manager only - global cycles)
router.post('/',
  auth,
  authorize('manager'),
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
router.put('/:cycleId', auth, authorize('manager'), async (req, res) => {
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
router.post('/:cycleId/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { studentIds } = req.body;

    const cycle = await PlacementCycle.findById(req.params.cycleId);
    if (!cycle) {
      return res.status(404).json({ message: 'Placement cycle not found' });
    }

    // Build student query - POC can only assign their campus students
    let studentQuery = { _id: { $in: studentIds }, role: 'student' };
    if (req.user.role === 'campus_poc') {
      studentQuery.campus = req.user.campus;
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
router.delete('/:cycleId/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { studentIds } = req.body;

    const cycle = await PlacementCycle.findById(req.params.cycleId);
    if (!cycle) {
      return res.status(404).json({ message: 'Placement cycle not found' });
    }

    // Build student query - POC can only remove their campus students
    let studentQuery = { _id: { $in: studentIds }, placementCycle: cycle._id };
    if (req.user.role === 'campus_poc') {
      studentQuery.campus = req.user.campus;
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

// Get unassigned students (POC sees their campus, others can filter)
router.get('/unassigned/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    let query = {
      role: 'student',
      $or: [
        { placementCycle: null },
        { placementCycle: { $exists: false } }
      ]
    };

    // POC only sees their campus students
    if (req.user.role === 'campus_poc') {
      query.campus = req.user.campus;
    } else if (req.query.campus) {
      query.campus = req.query.campus;
    }

    const students = await User.find(query)
      .select('firstName lastName email campus studentProfile.currentSchool')
      .populate('campus', 'name code');

    res.json(students);
  } catch (error) {
    console.error('Get unassigned students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get students in a placement cycle (with campus filter for POC)
router.get('/:cycleId/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const cycle = await PlacementCycle.findById(req.params.cycleId);
    if (!cycle) {
      return res.status(404).json({ message: 'Placement cycle not found' });
    }

    let studentQuery = { role: 'student', placementCycle: cycle._id };

    // POC only sees their campus students
    if (req.user.role === 'campus_poc') {
      studentQuery.campus = req.user.campus;
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
