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
    const { campus, school, batch, page = 1, limit = 20, search } = req.query;
    
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
        'currentSchool', 'currentModule', 'customModuleDescription'
      ];

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

      if (updates.softSkills) {
        user.studentProfile.softSkills = {
          ...user.studentProfile.softSkills,
          ...updates.softSkills
        };
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

      // If profile was approved and user made changes, set to draft
      if (user.studentProfile.profileStatus === 'approved') {
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

    if (updates.technicalSkills) {
      student.studentProfile.technicalSkills = updates.technicalSkills;
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
    const { skillId } = req.body;
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
      status: 'pending'
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

    res.json({ message: 'Skill added, pending approval' });
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
      currentModule
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

    const count = await User.countDocuments(query);

    res.json({ count });
  } catch (error) {
    console.error('Get eligible count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
