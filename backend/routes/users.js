const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth, authorize, sameCampus } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get all students (for Campus POCs, Coordinators, Managers)
router.get('/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { campus, school, batch, page = 1, limit = 20, search, status } = req.query;

    let query = { role: 'student' };

    // Campus POCs can see students from their managed campuses
    if (req.user.role === 'campus_poc') {
      const managedCampuses = req.user.managedCampuses?.length > 0
        ? req.user.managedCampuses
        : (req.user.campus ? [req.user.campus] : []);

      if (managedCampuses.length > 0) {
        query.campus = { $in: managedCampuses };
      }
    } else if (campus) {
      query.campus = campus;
    }

    if (school) {
      query['studentProfile.currentSchool'] = school;
    }

    if (batch) {
      query['studentProfile.batch'] = batch;
    }

    if (status) {
      query['studentProfile.currentStatus'] = status;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await User.find(query)
      .select('-password')
      .populate('campus')
      .populate('studentProfile.skills.skill')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      students,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student by ID
router.get('/students/:studentId', auth, authorize('campus_poc', 'coordinator', 'manager'), sameCampus, async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.studentId, role: 'student' })
      .select('-password')
      .populate('campus')
      .populate('studentProfile.skills.skill')
      .populate('studentProfile.skills.approvedBy', 'firstName lastName');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update student status (placed, unplaced, etc.)
router.put('/students/:studentId/status', auth, authorize('campus_poc', 'coordinator', 'manager'), sameCampus, async (req, res) => {
  try {
    const { status } = req.body;
    const { studentId } = req.params;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    student.studentProfile.currentStatus = status;
    await student.save();

    // Notify student
    await Notification.create({
      recipient: studentId,
      type: 'status_update',
      title: 'Status Updated',
      message: `Your placement status has been updated to ${status.replace(/_/g, ' ')}.`,
      link: '/profile',
      relatedEntity: { type: 'user', id: studentId }
    });

    res.json({
      message: 'Student status updated successfully',
      status: student.studentProfile.currentStatus
    });
  } catch (error) {
    console.error('Update student status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update student profile (for students)
router.put('/profile', auth, authorize('student'), upload.single('resume'), async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findById(req.userId);

    // Update basic info
    if (updates.firstName) user.firstName = updates.firstName;
    if (updates.lastName) user.lastName = updates.lastName;
    if (updates.phone) user.phone = updates.phone;

    // Update campus
    if (updates.campus) {
      user.campus = updates.campus;
    }

    // Update student profile
    if (user.role === 'student') {
      const profileUpdates = [
        'linkedIn', 'github', 'portfolio', 'about',
        'currentSchool', 'currentModule', 'customModuleDescription', 'resumeLink'
      ];

      // Validate resume link if present before applying
      if (updates.resumeLink !== undefined) {
        const { checkUrlAccessible } = require('../utils/urlChecker');
        const check = await checkUrlAccessible(updates.resumeLink);
        if (!check.ok) {
          return res.status(400).json({ message: 'Resume link is not accessible', reason: check.reason || 'inaccessible' });
        }
      }

      profileUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          user.studentProfile[field] = updates[field];
        }
      });

      // Handle joining date
      if (updates.joiningDate) {
        user.studentProfile.joiningDate = new Date(updates.joiningDate);
      }

      // Handle nested objects for academic details
      if (updates.tenthGrade) {
        user.studentProfile.tenthGrade = {
          ...user.studentProfile.tenthGrade,
          ...updates.tenthGrade
        };
      }

      if (updates.twelfthGrade) {
        user.studentProfile.twelfthGrade = {
          ...user.studentProfile.twelfthGrade,
          ...updates.twelfthGrade
        };
      }

      // Handle hometown
      if (updates.hometown) {
        user.studentProfile.hometown = {
          ...user.studentProfile.hometown,
          ...updates.hometown
        };
      }

      // Handle open for roles
      if (updates.openForRoles) {
        user.studentProfile.openForRoles = updates.openForRoles;
      }

      if (updates.englishProficiency) {
        user.studentProfile.englishProficiency = {
          ...user.studentProfile.englishProficiency,
          ...updates.englishProficiency
        };
      }

      if (updates.softSkills !== undefined) {
        // Accept both object mapping (from frontend) and array (legacy/new clients)
        const existing = user.studentProfile.softSkills || [];

        if (Array.isArray(updates.softSkills)) {
          // Replace or merge arrays (incoming array expected to have objects { skillName, selfRating })
          // We'll merge by skillName to avoid duplicates
          const map = new Map(existing.map(s => [s.skillName, s]));
          updates.softSkills.forEach(s => {
            if (!s) return;
            const key = s.skillName || (s.skillId && s.skillId.toString());
            const prev = map.get(key) || {};
            map.set(key, { ...prev, ...s });
          });
          user.studentProfile.softSkills = Array.from(map.values());
        } else if (typeof updates.softSkills === 'object' && updates.softSkills !== null) {
          // Incoming is an object mapping keys -> rating. Convert to array entries.
          const arr = Array.isArray(existing) ? existing.slice() : [];
          const toLabel = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
          for (const [k, v] of Object.entries(updates.softSkills)) {
            const label = toLabel(k);
            const found = arr.find(s => (s.skillName && s.skillName.toLowerCase() === label.toLowerCase()));
            if (found) {
              found.selfRating = Number(v) || 0;
            } else {
              arr.push({ skillName: label, selfRating: Number(v) || 0 });
            }
          }
          user.studentProfile.softSkills = arr;
        }
      }

      if (updates.technicalSkills) {
        user.studentProfile.technicalSkills = updates.technicalSkills;
      }

      // Handle higher education
      if (updates.higherEducation) {
        user.studentProfile.higherEducation = updates.higherEducation;
      }

      // Handle courses
      if (updates.courses) {
        user.studentProfile.courses = updates.courses;
      }

      // Handle resume upload
      if (req.file) {
        user.studentProfile.resume = req.file.path;
      }

      // If profile was approved and user made changes, set to draft and save snapshot
      if (user.studentProfile.profileStatus === 'approved') {
        user.studentProfile.lastApprovedSnapshot = { ...user.studentProfile.toObject() };
        user.studentProfile.profileStatus = 'draft';
      }
    }

    await user.save();

    const updatedUser = await User.findById(req.userId)
      .select('-password')
      .populate('campus')
      .populate('studentProfile.skills.skill');

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit profile for approval (for students)
router.post('/profile/submit', auth, authorize('student'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);

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

    for (const poc of campusPocs) {
      await Notification.create({
        recipient: poc._id,
        type: 'profile_approval_needed',
        title: 'Profile Approval Needed',
        message: `${user.firstName} ${user.lastName} has submitted their profile for approval.`,
        link: `/students/${user._id}`,
        relatedEntity: { type: 'user', id: user._id }
      });
    }

    res.json({ message: 'Profile submitted for approval' });
  } catch (error) {
    console.error('Submit profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update managed campuses (for Campus POCs)
router.put('/managed-campuses', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const { campusIds } = req.body;

    if (!Array.isArray(campusIds)) {
      return res.status(400).json({ message: 'campusIds must be an array' });
    }

    const user = await User.findById(req.userId);
    user.managedCampuses = campusIds;
    await user.save();

    const updatedUser = await User.findById(req.userId)
      .select('-password')
      .populate('managedCampuses', 'name code');

    res.json({
      message: 'Managed campuses updated successfully',
      managedCampuses: updatedUser.managedCampuses
    });
  } catch (error) {
    console.error('Update managed campuses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get managed campuses (for Campus POCs)
router.get('/managed-campuses', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('managedCampuses', 'name code')
      .populate('campus', 'name code');

    const managedCampuses = user.managedCampuses?.length > 0
      ? user.managedCampuses
      : (user.campus ? [user.campus] : []);

    res.json({ managedCampuses });
  } catch (error) {
    console.error('Get managed campuses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/Reject student profile (for Campus POCs)
router.put('/students/:studentId/profile/approve', auth, authorize('campus_poc', 'coordinator', 'manager'), sameCampus, async (req, res) => {
  try {
    const { status, revisionNotes } = req.body; // 'approved' or 'needs_revision'
    const { studentId } = req.params;

    if (!['approved', 'needs_revision'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    student.studentProfile.profileStatus = status;

    if (status === 'approved') {
      // Save a snapshot of this approved profile for future diffing
      student.studentProfile.lastApprovedSnapshot = JSON.parse(JSON.stringify(student.studentProfile));
      student.studentProfile.approvedBy = req.userId;
      student.studentProfile.approvedAt = new Date();
      student.studentProfile.revisionNotes = '';
    } else {
      student.studentProfile.revisionNotes = revisionNotes || 'Please review and update your profile.';
    }

    await student.save();

    // Notify student
    await Notification.create({
      recipient: studentId,
      type: status === 'approved' ? 'profile_approved' : 'profile_needs_revision',
      title: status === 'approved' ? 'Profile Approved' : 'Profile Needs Revision',
      message: status === 'approved'
        ? 'Your profile has been approved by Campus POC.'
        : `Your profile needs revision: ${revisionNotes || 'Please check with Campus POC.'}`,
      link: '/profile',
      relatedEntity: { type: 'user', id: studentId }
    });

    res.json({ message: `Profile ${status === 'approved' ? 'approved' : 'sent for revision'} successfully` });
  } catch (error) {
    console.error('Approve profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get students pending profile approval (for Campus POCs)
router.get('/pending-profiles', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    let query = {
      role: 'student',
      'studentProfile.profileStatus': 'pending_approval'
    };

    // Campus POC can see students from their managed campuses
    if (req.user.role === 'campus_poc') {
      const managedCampuses = req.user.managedCampuses?.length > 0
        ? req.user.managedCampuses
        : (req.user.campus ? [req.user.campus] : []);

      if (managedCampuses.length > 0) {
        query.campus = { $in: managedCampuses };
      }
    }

    const students = await User.find(query)
      .select('-password')
      .populate('campus', 'name')
      .sort({ 'studentProfile.lastSubmittedAt': -1 });

    res.json({ data: students, total: students.length });
  } catch (error) {
    console.error('Get pending profiles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update student profile by manager/coordinator/POC
router.put('/students/:studentId/profile', auth, authorize('campus_poc', 'coordinator', 'manager'), sameCampus, async (req, res) => {
  try {
    const { studentId } = req.params;
    const updates = req.body;

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Update basic info
    if (updates.firstName) student.firstName = updates.firstName;
    if (updates.lastName) student.lastName = updates.lastName;
    if (updates.phone) student.phone = updates.phone;

    // Validate resume link if present before applying (by manager/POC)
    if (updates.resumeLink !== undefined) {
      const { checkUrlAccessible } = require('../utils/urlChecker');
      const check = await checkUrlAccessible(updates.resumeLink);
      if (!check.ok) {
        return res.status(400).json({ message: 'Resume link is not accessible', reason: check.reason || 'inaccessible' });
      }
      // Apply it
      student.studentProfile.resumeLink = updates.resumeLink;
    }

    // Update student profile fields
    const profileUpdates = [
      'currentSchool', 'currentModule', 'customModuleDescription',
      'linkedIn', 'github', 'portfolio', 'about'
    ];

    profileUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        student.studentProfile[field] = updates[field];
      }
    });

    if (updates.joiningDate) {
      student.studentProfile.joiningDate = new Date(updates.joiningDate);
    }

    if (updates.tenthGrade) {
      student.studentProfile.tenthGrade = { ...student.studentProfile.tenthGrade, ...updates.tenthGrade };
    }

    if (updates.twelfthGrade) {
      student.studentProfile.twelfthGrade = { ...student.studentProfile.twelfthGrade, ...updates.twelfthGrade };
    }

    if (updates.hometown) {
      student.studentProfile.hometown = { ...student.studentProfile.hometown, ...updates.hometown };
    }

    if (updates.openForRoles) {
      student.studentProfile.openForRoles = updates.openForRoles;
    }

    if (Array.isArray(updates.technicalSkills)) {
      // Merge incoming technical skills with existing ones to avoid unintentionally
      // wiping skills approved by POCs which the client may not be aware of.
      const existing = student.studentProfile.technicalSkills || [];
      const map = new Map(existing.map(s => [(s.skillId && s.skillId.toString()) || s.skillName, s]));

      updates.technicalSkills.forEach(s => {
        const key = (s.skillId && s.skillId.toString()) || s.skillName;
        const prev = map.get(key) || {};
        // Merge fields (incoming values override previous)
        const merged = { ...prev, ...s };
        map.set(key, merged);
      });

      student.studentProfile.technicalSkills = Array.from(map.values());
    }

    if (updates.englishProficiency) {
      student.studentProfile.englishProficiency = { ...student.studentProfile.englishProficiency, ...updates.englishProficiency };
    }

    if (updates.softSkills) {
      student.studentProfile.softSkills = { ...student.studentProfile.softSkills, ...updates.softSkills };
    }

    await student.save();

    const updatedStudent = await User.findById(studentId)
      .select('-password')
      .populate('campus');

    res.json({ message: 'Student profile updated successfully', student: updatedStudent });
  } catch (error) {
    console.error('Update student profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add skill to student profile
router.post('/profile/skills', auth, authorize('student'), async (req, res) => {
  try {
    const { skillId, selfRating } = req.body;
    const user = await User.findById(req.userId);

    // Check if skill already exists
    const existingSkill = user.studentProfile.skills.find(
      s => s.skill.toString() === skillId
    );

    if (existingSkill) {
      return res.status(400).json({ message: 'Skill already added' });
    }

    user.studentProfile.skills.push({
      skill: skillId,
      status: 'pending',
      selfRating: typeof selfRating === 'number' ? selfRating : 0
    });

    await user.save();

    // Notify Campus POC
    const campusPocs = await User.find({ role: 'campus_poc', campus: user.campus });
    const Skill = require('../models/Skill');
    const skill = await Skill.findById(skillId);

    for (const poc of campusPocs) {
      await Notification.create({
        recipient: poc._id,
        type: 'skill_approval_needed',
        title: 'Skill Approval Needed',
        message: `${user.firstName} ${user.lastName} has added "${skill.name}" and needs approval.`,
        link: `/students/${user._id}`,
        relatedEntity: { type: 'user', id: user._id }
      });
    }

    const added = user.studentProfile.skills.find(s => s.skill.toString() === skillId);

    res.json({ message: 'Skill added, pending approval', skill: added });
  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/Reject student skill (for Campus POCs)
router.put('/students/:studentId/skills/:skillId', auth, authorize('campus_poc', 'coordinator'), sameCampus, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const { studentId, skillId } = req.params;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const skillIndex = student.studentProfile.skills.findIndex(
      s => s.skill.toString() === skillId
    );

    if (skillIndex === -1) {
      return res.status(404).json({ message: 'Skill not found in student profile' });
    }

    student.studentProfile.skills[skillIndex].status = status;
    student.studentProfile.skills[skillIndex].approvedBy = req.userId;
    student.studentProfile.skills[skillIndex].approvedAt = new Date();

    // If approved, ensure it exists (or is updated) in technicalSkills with the same rating
    if (status === 'approved') {
      const pendingSkill = student.studentProfile.skills[skillIndex];
      const rating = pendingSkill.selfRating || 0;
      const exists = student.studentProfile.technicalSkills.find(s => s.skillId?.toString() === skillId.toString());
      if (!exists) {
        student.studentProfile.technicalSkills.push({
          skillId: skillId,
          skillName: (await require('../models/Skill').findById(skillId))?.name || '',
          selfRating: rating
        });
      } else {
        exists.selfRating = rating;
      }
    }

    await student.save();

    // Notify student
    const Skill = require('../models/Skill');
    const skill = await Skill.findById(skillId);

    await Notification.create({
      recipient: studentId,
      type: status === 'approved' ? 'skill_approved' : 'skill_rejected',
      title: `Skill ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      message: `Your skill "${skill.name}" has been ${status}.`,
      link: '/profile',
      relatedEntity: { type: 'skill', id: skillId }
    });

    res.json({ message: `Skill ${status} successfully` });
  } catch (error) {
    console.error('Approve skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get students with pending skills (for Campus POCs)
router.get('/pending-skills', auth, authorize('campus_poc', 'coordinator'), async (req, res) => {
  try {
    let query = {
      role: 'student',
      'studentProfile.skills.status': 'pending'
    };

    if (req.user.role === 'campus_poc') {
      query.campus = req.user.campus;
    }

    const students = await User.find(query)
      .select('firstName lastName email studentProfile.skills campus')
      .populate('campus', 'name')
      .populate('studentProfile.skills.skill');

    // Filter to only show pending skills
    const result = students.map(student => ({
      ...student.toObject(),
      pendingSkills: student.studentProfile.skills.filter(s => s.status === 'pending')
    }));

    res.json(result);
  } catch (error) {
    console.error('Get pending skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload avatar
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.userId);
    user.avatar = req.file.path;
    await user.save();

    res.json({ message: 'Avatar uploaded successfully', avatar: req.file.path });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unique student locations (hometown/state) for eligibility
router.get('/student-locations', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const locations = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: null,
          districts: { $addToSet: "$studentProfile.hometown.district" },
          states: { $addToSet: "$studentProfile.hometown.state" }
        }
      }
    ]);

    if (locations.length > 0) {
      res.json({
        districts: locations[0].districts.filter(d => d).sort(),
        states: locations[0].states.filter(s => s).sort()
      });
    } else {
      res.json({ districts: [], states: [] });
    }
  } catch (error) {
    console.error('Get student locations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get eligible student count based on criteria (for Coordinators)
router.get('/eligible-count', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const {
      tenthRequired,
      tenthMinPercentage,
      twelfthRequired,
      twelfthMinPercentage,
      higherEducationRequired,
      higherEducationMinPercentage,
      schools,
      campuses,
      currentModule,
      hometown,
      homestate,
      gender
    } = req.query;

    // Build query for students
    let query = {
      role: 'student',
      'studentProfile.profileStatus': 'approved'
    };

    // Academic requirements
    if (tenthRequired === 'true' && tenthMinPercentage) {
      query['studentProfile.tenthMarks'] = { $gte: parseFloat(tenthMinPercentage) };
    }

    if (twelfthRequired === 'true' && twelfthMinPercentage) {
      query['studentProfile.twelfthMarks'] = { $gte: parseFloat(twelfthMinPercentage) };
    }

    if (higherEducationRequired === 'true' && higherEducationMinPercentage) {
      query['studentProfile.higherEducationMarks'] = { $gte: parseFloat(higherEducationMinPercentage) };
    }

    // Navgurukul specific filters
    if (schools) {
      const schoolList = schools.split(',').filter(s => s.trim());
      if (schoolList.length > 0) {
        query['studentProfile.currentSchool'] = { $in: schoolList };
      }
    }

    if (campuses) {
      const campusList = campuses.split(',').filter(c => c.trim());
      if (campusList.length > 0) {
        query.campus = { $in: campusList };
      }
    }

    if (currentModule) {
      query['studentProfile.currentModule'] = currentModule;
    }

    // New Filters
    if (hometown) {
      // Case insensitive match for hometown district
      query['studentProfile.hometown.district'] = { $regex: new RegExp(`^${hometown}$`, 'i') };
    }

    if (homestate) {
      query['studentProfile.hometown.state'] = { $regex: new RegExp(`^${homestate}$`, 'i') };
    }

    if (gender && gender !== 'any') {
      query.gender = gender;
    }

    // Checking for Council Post Eligibility
    // (This requires looking into user's councilService array)
    // format of query parameter: councilPost=PostName,minMonths=6
    // But typically passed as separate params or json
    // Let's assume passed as `councilPost` and `minCouncilMonths`
    const { councilPost, minCouncilMonths } = req.query;

    if (councilPost) {
      // Using $elemMatch to find students who have the specific post with enough months and approved status
      query.studentProfile.councilService = {
        $elemMatch: {
          post: councilPost, // Exact match
          monthsServed: { $gte: parseInt(minCouncilMonths || 0) },
          status: 'approved'
        }
      };
    }

    const count = await User.countDocuments(query);

    res.json({ count });
  } catch (error) {
    console.error('Get eligible count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// Get list of active coordinators (used for job assignment and filters)
router.get('/coordinators', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const coordinators = await User.find({ role: 'coordinator', isActive: true })
      .select('firstName lastName email _id')
      .sort({ firstName: 1 });

    res.json({ coordinators });
  } catch (error) {
    console.error('Get coordinators error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// Export-presets API for saving user presets (max 2)
router.get('/me/export-presets', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('exportPresets');
    res.json({ presets: user.exportPresets || [] });
  } catch (error) {
    console.error('Get export presets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/me/export-presets', auth, async (req, res) => {
  try {
    const { name, fields, format, layout } = req.body;
    if (!name || !fields) {
      return res.status(400).json({ message: 'Name and fields are required' });
    }

    const user = await User.findById(req.userId);
    user.exportPresets = user.exportPresets || [];
    if (user.exportPresets.length >= 2) {
      return res.status(400).json({ message: 'Maximum of 2 presets allowed' });
    }

    const preset = { name, fields, format: format || 'pdf', layout: layout || 'resume' };
    user.exportPresets.push(preset);
    await user.save();

    res.json({ presets: user.exportPresets });
  } catch (error) {
    console.error('Create export preset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/me/export-presets/:presetId', auth, async (req, res) => {
  try {
    const { presetId } = req.params;
    const user = await User.findById(req.userId);
    user.exportPresets = (user.exportPresets || []).filter(p => p._id.toString() !== presetId);
    await user.save();
    res.json({ presets: user.exportPresets });
  } catch (error) {
    console.error('Delete export preset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's AI API keys
router.get('/me/ai-keys', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('aiApiKeys');
    // Return keys with masked values for security
    const maskedKeys = (user.aiApiKeys || []).map(k => ({
      _id: k._id,
      label: k.label,
      keyPreview: k.key ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : '',
      addedAt: k.addedAt,
      isActive: k.isActive
    }));
    res.json({ keys: maskedKeys });
  } catch (error) {
    console.error('Get AI keys error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add AI API key
router.post('/me/ai-keys', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { key, label } = req.body;

    if (!key || !key.trim()) {
      return res.status(400).json({ message: 'API key is required' });
    }

    const user = await User.findById(req.userId);
    if (!user.aiApiKeys) user.aiApiKeys = [];

    // Limit to 5 keys per user
    if (user.aiApiKeys.length >= 5) {
      return res.status(400).json({ message: 'Maximum 5 API keys allowed per user' });
    }

    user.aiApiKeys.push({
      key: key.trim(),
      label: label || `Key ${user.aiApiKeys.length + 1}`,
      addedAt: new Date(),
      isActive: true
    });

    await user.save();

    // Return masked keys
    const maskedKeys = user.aiApiKeys.map(k => ({
      _id: k._id,
      label: k.label,
      keyPreview: k.key ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : '',
      addedAt: k.addedAt,
      isActive: k.isActive
    }));

    res.json({ message: 'API key added successfully', keys: maskedKeys });
  } catch (error) {
    console.error('Add AI key error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update AI API key (toggle active status or update label)
router.patch('/me/ai-keys/:keyId', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { keyId } = req.params;
    const { isActive, label } = req.body;

    const user = await User.findById(req.userId);
    const keyIndex = user.aiApiKeys.findIndex(k => k._id.toString() === keyId);

    if (keyIndex === -1) {
      return res.status(404).json({ message: 'API key not found' });
    }

    if (typeof isActive === 'boolean') {
      user.aiApiKeys[keyIndex].isActive = isActive;
    }
    if (label !== undefined) {
      user.aiApiKeys[keyIndex].label = label;
    }

    await user.save();

    // Return masked keys
    const maskedKeys = user.aiApiKeys.map(k => ({
      _id: k._id,
      label: k.label,
      keyPreview: k.key ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : '',
      addedAt: k.addedAt,
      isActive: k.isActive
    }));

    res.json({ message: 'API key updated successfully', keys: maskedKeys });
  } catch (error) {
    console.error('Update AI key error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete AI API key
router.delete('/me/ai-keys/:keyId', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { keyId } = req.params;
    const user = await User.findById(req.userId);
    user.aiApiKeys = (user.aiApiKeys || []).filter(k => k._id.toString() !== keyId);
    await user.save();

    // Return masked keys
    const maskedKeys = user.aiApiKeys.map(k => ({
      _id: k._id,
      label: k.label,
      keyPreview: k.key ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : '',
      addedAt: k.addedAt,
      isActive: k.isActive
    }));

    res.json({ message: 'API key deleted successfully', keys: maskedKeys });
  } catch (error) {
    console.error('Delete AI key error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
