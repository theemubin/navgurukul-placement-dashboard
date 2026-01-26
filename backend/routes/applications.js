const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const Notification = require('../models/Notification');
const PlacementCycle = require('../models/PlacementCycle');
const { StudentJobReadiness } = require('../models/JobReadiness');
const discordService = require('../services/discordService');
const { auth, authorize, sameCampus } = require('../middleware/auth');

// Get applications (filtered by role)
router.get('/', auth, async (req, res) => {
  try {
    const { job, status, student, page = 1, limit = 20, myLeads } = req.query;
    let query = {};

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

    const { jobId, coverLetter, customResponses, type = 'regular' } = req.body;

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
    const readinessRequirement = job.eligibility?.readinessRequirement || 'yes';

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

    const application = new Application({
      student: req.userId,
      job: jobId,
      resume: student.studentProfile.resume,
      coverLetter,
      customResponses: customResponses || [],
      applicationType: type,
      status: type === 'interest' ? 'interested' : 'applied'
    });

    await application.save();

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

// Update application status (Coordinators only)
router.put('/:id/status', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { status, feedback } = req.body;

    const application = await Application.findById(req.params.id)
      .populate('job', 'title company.name')
      .populate('student');

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
      .populate('student', 'firstName lastName email phone gender studentProfile campus')
      .populate({
        path: 'student',
        populate: [
          { path: 'campus', select: 'name' },
          { path: 'studentProfile.skills.skill' }
        ]
      })
      .populate('job', 'title company.name location jobType salary')
      .populate('feedbackBy', 'firstName lastName');

    // Available fields mapping (Ordered for exports)
    const fieldMap = {
      // 1. Basic Student Info
      studentName: (app) => `${app.student.firstName} ${app.student.lastName}`,
      email: (app) => app.student.email,
      phone: (app) => app.student.phone || '',
      gender: (app) => app.student.gender || '',

      // 2. Education (Navgurukul)
      school: (app) => app.student.studentProfile?.currentSchool || '',
      joiningDate: (app) => app.student.studentProfile?.dateOfJoining ? new Date(app.student.studentProfile.dateOfJoining).toLocaleDateString() : '',
      currentModule: (app) => app.student.studentProfile?.currentModule || '',
      attendance: (app) => app.student.studentProfile?.attendancePercentage || '',

      // 3. Profile Links
      resume: (app) => app.student.studentProfile?.resume || '',
      github: (app) => app.student.studentProfile?.github || '',
      portfolio: (app) => app.student.studentProfile?.portfolio || '',
      linkedIn: (app) => app.student.studentProfile?.linkedIn || '',

      // 4. Academic Background
      higherEducation: (app) => app.student.studentProfile?.higherEducation?.map(edu =>
        `${edu.degree} in ${edu.fieldOfStudy} from ${edu.institution} (${edu.startYear}-${edu.endYear})`
      ).join('; ') || '',
      tenthPercentage: (app) => app.student.studentProfile?.tenthGrade?.percentage || '',
      twelfthPercentage: (app) => app.student.studentProfile?.twelfthGrade?.percentage || '',

      // 5. Skills & Rest
      jobTitle: (app) => app.job.title,
      company: (app) => app.job.company.name,
      location: (app) => app.job.location,
      jobType: (app) => app.job.jobType,
      salary: (app) => app.job.salary?.min && app.job.salary?.max ? `${app.job.salary.min}-${app.job.salary.max}` : '',
      status: (app) => app.status,
      appliedDate: (app) => app.createdAt.toISOString().split('T')[0],
      coverLetter: (app) => app.coverLetter || '',
      feedback: (app) => app.feedback || ''
    };

    // Maintain consistent column order based on fieldMap indices
    const fieldOrder = Object.keys(fieldMap);
    const selectedFields = (fields?.length > 0 ? fields : fieldOrder)
      .sort((a, b) => fieldOrder.indexOf(a) - fieldOrder.indexOf(b));

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

// Get available export fields
router.get('/export/fields', auth, authorize('coordinator', 'manager'), async (req, res) => {
  const fields = [
    // 1. Basic Student Info (PERSONEL)
    { key: 'studentName', label: 'Student Name', category: 'Student Info' },
    { key: 'email', label: 'Email', category: 'Student Info' },
    { key: 'phone', label: 'Phone', category: 'Student Info' },
    { key: 'gender', label: 'Gender', category: 'Student Info' },
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
