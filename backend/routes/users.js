const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Notification = require('../models/Notification');
const discordService = require('../services/discordService');
const { auth, authorize, sameCampus } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get all students (for Campus POCs, Coordinators, Managers)
router.get('/students', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    // Accept pagination, filters and sorting
    const { campus, school, batch, page = 1, limit = 20, search, status, sortField, sortOrder } = req.query;

    let query = { role: 'student' };

    // Default: show only Active students if status not provided
    const statusFilter = status || 'Active';

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

    if (statusFilter) {
      query['studentProfile.currentStatus'] = statusFilter;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting: support sortField and sortOrder; default to oldest joining active student first
    let sortObj = {};
    if (sortField) {
      sortObj[sortField] = sortOrder === 'desc' ? -1 : 1;
    } else {
      // Default order: ascending by joining date, then by createdAt as tiebreaker
      sortObj = { 'studentProfile.joiningDate': 1, createdAt: 1 };
    }

    // Support a lightweight summary mode to return minimal fields for list views
    if (req.query.summary === 'true') {
      const students = await User.find(query)
        .select('firstName lastName email campus studentProfile.currentStatus studentProfile.joiningDate')
        .populate('campus', 'name')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort(sortObj);

      const total = await User.countDocuments(query);

      return res.json({
        students,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    }

    // Full student payload (used when opening student detail)
    const students = await User.find(query)
      .select('-password')
      .populate('campus')
      .populate('studentProfile.skills.skill')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort(sortObj);

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

// Update profile (students and staff) - allow coordinators/managers/campus_poc to update their own discord and basic info
router.put('/profile', auth, authorize('student', 'coordinator', 'manager', 'campus_poc'), upload.single('resume'), async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findById(req.userId);

    // Update basic info
    if (updates.firstName) user.firstName = updates.firstName;
    if (updates.lastName) user.lastName = updates.lastName;
    if (updates.phone) user.phone = updates.phone;

    // Update Discord info
    if (updates.discord) {
      if (!user.discord) user.discord = { userId: '', username: '', verified: false };

      // If ID changes, reset verification
      if (updates.discord.userId !== undefined) {
        if (user.discord.userId !== updates.discord.userId) {
          user.discord.verified = false;
          user.discord.verifiedAt = null;
        }
        user.discord.userId = updates.discord.userId;
      }

      if (updates.discord.username !== undefined) {
        user.discord.username = updates.discord.username;
      }
    }

    // Update campus
    if (updates.campus) {
      user.campus = updates.campus;
    }

    // Update student profile
    if (user.role === 'student') {
      const profileUpdates = [
        'linkedIn', 'github', 'portfolio', 'about',
        'currentSchool', 'currentModule', 'customModuleDescription', 'resumeLink', 'houseName'
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
        user.studentProfile.softSkills = Array.isArray(updates.softSkills) ? updates.softSkills : [];
      }

      if (updates.technicalSkills !== undefined) {
        user.studentProfile.technicalSkills = Array.isArray(updates.technicalSkills) ? updates.technicalSkills : [];
      }

      if (updates.officeSkills !== undefined) {
        user.studentProfile.officeSkills = Array.isArray(updates.officeSkills) ? updates.officeSkills : [];
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

    console.log('Profile updated for user:', req.userId, 'role:', updatedUser.role);
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

    const student = await User.findById(studentId).populate('campus');
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

    // Send to Discord
    await discordService.sendProfileUpdate(student, status, req.user);

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

    if (updates.technicalSkills !== undefined) {
      student.studentProfile.technicalSkills = Array.isArray(updates.technicalSkills) ? updates.technicalSkills : [];
    }

    if (updates.softSkills !== undefined) {
      student.studentProfile.softSkills = Array.isArray(updates.softSkills) ? updates.softSkills : [];
    }

    if (updates.officeSkills !== undefined) {
      student.studentProfile.officeSkills = Array.isArray(updates.officeSkills) ? updates.officeSkills : [];
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
      gender,
      femaleOnly,
      minAttendance,
      minMonthsAtNavgurukul,
      readinessRequirement,
      houses,
      englishSpeaking,
      englishWriting,
      certifications,
      requiredSkills
    } = req.query;

    // Build query for students
    let query = {
      role: 'student',
      'studentProfile.profileStatus': 'approved',
      isActive: true
    };

    // Academic requirements
    if (tenthRequired === 'true' && tenthMinPercentage) {
      query['studentProfile.tenthGrade.percentage'] = { $gte: parseFloat(tenthMinPercentage) };
    }

    if (twelfthRequired === 'true' && twelfthMinPercentage) {
      query['studentProfile.twelfthGrade.percentage'] = { $gte: parseFloat(twelfthMinPercentage) };
    }

    if (higherEducationRequired === 'true' && higherEducationMinPercentage) {
      query['studentProfile.higherEducation.percentage'] = { $gte: parseFloat(higherEducationMinPercentage) };
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

    // Geographic filters
    if (hometown) {
      // Case insensitive match for hometown district
      query['studentProfile.hometown.district'] = { $regex: new RegExp(`^${hometown}$`, 'i') };
    }

    if (homestate) {
      query['studentProfile.hometown.state'] = { $regex: new RegExp(`^${homestate}$`, 'i') };
    }

    // Gender filters
    if (femaleOnly === 'true') {
      query.gender = 'female';
    } else if (gender && gender !== 'any') {
      query.gender = gender;
    }

    // House filter
    if (houses) {
      const houseList = houses.split(',').filter(h => h.trim());
      if (houseList.length > 0) {
        query['studentProfile.houseName'] = { $in: houseList };
      }
    }

    // Attendance filter
    if (minAttendance) {
      query['studentProfile.attendance'] = { $gte: parseFloat(minAttendance) };
    }

    // Minimum months at Navgurukul
    if (minMonthsAtNavgurukul) {
      const minDate = new Date();
      minDate.setMonth(minDate.getMonth() - parseInt(minMonthsAtNavgurukul));
      query['studentProfile.joiningDate'] = { $lte: minDate };
    }

    // English proficiency (CEFR levels)
    const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

    if (englishSpeaking) {
      const minIndex = cefrOrder.indexOf(englishSpeaking);
      if (minIndex !== -1) {
        const acceptableLevels = cefrOrder.slice(minIndex);
        query['studentProfile.englishProficiency.speaking'] = { $in: acceptableLevels };
      }
    }

    if (englishWriting) {
      const minIndex = cefrOrder.indexOf(englishWriting);
      if (minIndex !== -1) {
        const acceptableLevels = cefrOrder.slice(minIndex);
        query['studentProfile.englishProficiency.writing'] = { $in: acceptableLevels };
      }
    }

    // Certifications filter
    if (certifications) {
      const certList = certifications.split(',').filter(c => c.trim());
      if (certList.length > 0) {
        query['studentProfile.certifications'] = { $all: certList };
      }
    }

    // Job Readiness Requirement
    if (readinessRequirement === 'yes') {
      // Student must be 100% ready (all criteria met)
      query['studentProfile.jobReadiness.overallStatus'] = 'ready';
    } else if (readinessRequirement === 'in_progress') {
      // Student must be at least 30% ready (in progress or ready)
      query['studentProfile.jobReadiness.overallStatus'] = { $in: ['in_progress', 'ready'] };
    }
    // If 'no' or not specified, no filter applied

    // Council Post Eligibility
    const { councilPost, minCouncilMonths } = req.query;

    if (councilPost) {
      // Using $elemMatch to find students who have the specific post with enough months and approved status
      query['studentProfile.councilService'] = {
        $elemMatch: {
          post: councilPost,
          monthsServed: { $gte: parseInt(minCouncilMonths || 0) },
          status: 'approved'
        }
      };
    }

    // Required Skills Filter
    // This is more complex - we need to check if students have ALL required skills at the minimum proficiency
    if (requiredSkills) {
      try {
        const skillsArray = JSON.parse(requiredSkills);

        if (Array.isArray(skillsArray) && skillsArray.length > 0) {
          // Build conditions for each required skill
          const skillConditions = skillsArray.map(reqSkill => {
            const skillId = reqSkill.skill?._id || reqSkill.skill;
            const minProficiency = reqSkill.proficiencyLevel || 1;

            return {
              'studentProfile.technicalSkills': {
                $elemMatch: {
                  skillId: skillId,
                  selfRating: { $gte: minProficiency }
                }
              }
            };
          });

          // Student must match ALL skill requirements
          if (!query.$and) {
            query.$and = [];
          }
          query.$and.push(...skillConditions);
        }
      } catch (parseError) {
        console.error('Error parsing requiredSkills:', parseError);
        // Continue without skills filter if parsing fails
      }
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

// === Admin / Manager User Management ===
// List all users (manager only)
router.get('/', auth, authorize('manager'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search, role } = req.query;
    let query = {};

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('managedCampuses', 'name')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ role: 1, createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({ users, pagination: { page: parseInt(page), pages: Math.ceil(total / limit), total } });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by id (manager only)
router.get('/:userId', auth, authorize('manager'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').populate('campus managedCampuses');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user (manager only) - role changes, basic fields
router.put('/:userId', auth, authorize('manager'), async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      firstName, lastName, email, role, isActive, managedCampuses,
      // student profile fields (for managers editing students)
      studentProfile
    } = req.body;

    // Load the user before changes for audit
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const userBefore = JSON.parse(JSON.stringify(user));

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;
    if (managedCampuses !== undefined) user.managedCampuses = managedCampuses;

    // Allow manager to update select studentProfile fields when editing a student
    if (studentProfile && user.role === 'student') {
      const { currentStatus, joiningDate, batch, currentSchool, linkedIn, resumeLink, resumeAccessibilityRemark, resumeAccessible, about } = studentProfile;
      if (currentStatus !== undefined) user.studentProfile.currentStatus = currentStatus;
      if (joiningDate !== undefined) user.studentProfile.joiningDate = new Date(joiningDate);
      // batch removed from modal requirement; keep updating if passed but UI no longer sends it
      if (batch !== undefined) user.studentProfile.batch = batch;
      if (currentSchool !== undefined) user.studentProfile.currentSchool = currentSchool;
      if (linkedIn !== undefined) user.studentProfile.linkedIn = linkedIn;
      if (about !== undefined) user.studentProfile.about = about;

      // If manager provided a resume link, verify accessibility and store decision and remark
      if (resumeLink !== undefined) {
        const { checkUrlAccessible } = require('../utils/urlChecker');
        let checkRes = { ok: null, status: null, reason: null };
        try {
          checkRes = await checkUrlAccessible(resumeLink);
        } catch (err) {
          // swallow and record reason
          checkRes = { ok: false, status: null, reason: err.message };
        }
        user.studentProfile.resumeLink = resumeLink;
        user.studentProfile.resumeAccessible = !!checkRes.ok;
        user.studentProfile.resumeAccessibilityRemark = resumeAccessibilityRemark || (checkRes.ok ? '' : (checkRes.reason || `HTTP ${checkRes.status || 'unknown'}`));
        // If explicit override was provided by manager, respect it
        if (resumeAccessible !== undefined) user.studentProfile.resumeAccessible = resumeAccessible;
        if (resumeAccessibilityRemark !== undefined) user.studentProfile.resumeAccessibilityRemark = resumeAccessibilityRemark;
      }
    }

    // Role change is sensitive - log timeline and notify user
    if (role && role !== user.role) {
      const oldRole = user.role;
      user.role = role;

      // Add notification about role change
      await Notification.create({
        recipient: user._id,
        type: 'role_changed',
        title: 'Your account role has changed',
        message: `Your role has been updated from ${oldRole} to ${role} by an administrator.`,
        link: '/profile',
        relatedEntity: { type: 'user', id: user._id }
      });
    }

    await user.save();

    // Build audit record by comparing saved user with previous snapshot
    const updated = await User.findById(userId).select('-password').populate('campus managedCampuses');

    try {
      const UserChangeLog = require('../models/UserChangeLog');
      const changes = [];

      const capture = (path, oldVal, newVal) => {
        const oldStr = (oldVal === undefined) ? null : oldVal;
        const newStr = (newVal === undefined) ? null : newVal;
        if (JSON.stringify(oldStr) !== JSON.stringify(newStr)) {
          changes.push({ path, oldValue: oldVal, newValue: newVal });
        }
      };

      // Basic fields
      capture('firstName', userBefore.firstName, updated.firstName);
      capture('lastName', userBefore.lastName, updated.lastName);
      capture('email', userBefore.email, updated.email);
      capture('role', userBefore.role, updated.role);
      capture('isActive', userBefore.isActive, updated.isActive);
      capture('managedCampuses', (userBefore.managedCampuses || []).map(String), (updated.managedCampuses || []).map(String));

      // Student profile fields (if target is student)
      if (updated.role === 'student') {
        const beforeSP = userBefore.studentProfile || {};
        const afterSP = updated.studentProfile || {};
        capture('studentProfile.currentStatus', beforeSP.currentStatus, afterSP.currentStatus);
        capture('studentProfile.joiningDate', beforeSP.joiningDate, afterSP.joiningDate);
        capture('studentProfile.currentSchool', beforeSP.currentSchool, afterSP.currentSchool);
        capture('studentProfile.linkedIn', beforeSP.linkedIn, afterSP.linkedIn);
        capture('studentProfile.resumeLink', beforeSP.resumeLink, afterSP.resumeLink);
        capture('studentProfile.resumeAccessible', beforeSP.resumeAccessible, afterSP.resumeAccessible);
        capture('studentProfile.resumeAccessibilityRemark', beforeSP.resumeAccessibilityRemark, afterSP.resumeAccessibilityRemark);
        capture('studentProfile.about', beforeSP.about, afterSP.about);
      }

      if (changes.length > 0) {
        await UserChangeLog.create({ user: updated._id, changedBy: req.userId, changeType: 'profile_update', fieldChanges: changes });
      }
    } catch (logErr) {
      console.error('Failed to write change log:', logErr);
    }

    res.json({ message: 'User updated', user: updated });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get audit history for a user (manager only)
router.get('/:userId/audit', auth, authorize('manager'), async (req, res) => {
  try {
    const UserChangeLog = require('../models/UserChangeLog');
    const logs = await UserChangeLog.find({ user: req.params.userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ logs });
  } catch (error) {
    console.error('Get user audit error:', error);
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
