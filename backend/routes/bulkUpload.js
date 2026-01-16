const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Campus = require('../models/Campus');
const SelfApplication = require('../models/SelfApplication');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');

// Configure multer for CSV uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Helper to parse CSV from buffer
const parseCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString());

    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Generate random password
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// GET sample CSV template for students
router.get('/sample/students', auth, authorize('campus_poc', 'coordinator', 'manager'), (req, res) => {
  const csvContent = `firstName,lastName,email,phone,campus,school,batch,tenthGrade,twelfthGrade,highestDegree,specialization,currentStatus
John,Doe,john.doe@example.com,9876543210,Bangalore,School of Programming,2024,85.5,78.2,B.Tech,Computer Science,Active
Jane,Smith,jane.smith@example.com,9876543211,Delhi,School of Programming,2024,90.0,88.5,B.Tech,Information Technology,Active
Rahul,Kumar,rahul.kumar@example.com,9876543212,Bangalore,School of Business,2025,75.0,72.0,MBA,Finance,Placed`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=students_sample.csv');
  res.send(csvContent);
});

// GET sample CSV template for self-applications
router.get('/sample/self-applications', auth, authorize('campus_poc', 'student'), (req, res) => {
  const csvContent = `companyName,jobTitle,jobUrl,location,salary,applicationDate,status,source,notes
Google,Software Engineer,https://careers.google.com/job123,Bangalore,25 LPA,2024-01-15,applied,LinkedIn,Applied via LinkedIn Easy Apply
Microsoft,Frontend Developer,https://careers.microsoft.com/job456,Remote,20 LPA,2024-01-10,interview_scheduled,Referral,Got referral from college senior
Amazon,SDE-1,https://amazon.jobs/job789,Hyderabad,22 LPA,2024-01-05,offer_received,Naukri,Offer letter received`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=self_applications_sample.csv');
  res.send(csvContent);
});

// POST bulk upload students
router.post('/students', auth, authorize('campus_poc', 'coordinator', 'manager'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const rows = await parseCSV(req.file.buffer);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    // Validate required columns
    const requiredColumns = ['firstName', 'lastName', 'email'];
    const csvColumns = Object.keys(rows[0]);
    const missingColumns = requiredColumns.filter(col => !csvColumns.includes(col));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    // Get campuses for mapping
    const campuses = await Campus.find({});
    const campusMap = {};
    campuses.forEach(c => {
      campusMap[c.name.toLowerCase()] = c._id;
      campusMap[c.code?.toLowerCase()] = c._id;
    });

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    // For campus POC, default to their campus
    const defaultCampusId = req.user.role === 'campus_poc' ? req.user.campus : null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      try {
        // Check if email already exists
        const existingUser = await User.findOne({ email: row.email?.toLowerCase()?.trim() });
        if (existingUser) {
          results.skipped.push({
            row: rowNum,
            email: row.email,
            reason: 'Email already exists'
          });
          continue;
        }

        // Map campus name to ID
        let campusId = defaultCampusId;
        if (row.campus) {
          campusId = campusMap[row.campus.toLowerCase().trim()] || defaultCampusId;
        }

        if (!campusId) {
          results.failed.push({
            row: rowNum,
            email: row.email,
            reason: 'Campus not found and no default available'
          });
          continue;
        }

        // Generate password
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userData = {
          firstName: row.firstName?.trim(),
          lastName: row.lastName?.trim(),
          email: row.email?.toLowerCase()?.trim(),
          password: hashedPassword,
          phone: row.phone?.trim() || '',
          role: 'student',
          campus: campusId,
          studentProfile: {
            currentSchool: row.school?.trim() || 'School of Programming',
            batch: row.batch?.trim() || new Date().getFullYear().toString(),
            tenthGrade: row.tenthGrade ? parseFloat(row.tenthGrade) : undefined,
            twelfthGrade: row.twelfthGrade ? parseFloat(row.twelfthGrade) : undefined,
            highestDegree: row.highestDegree?.trim() || '',
            profileStatus: 'draft',
            currentStatus: row.currentStatus?.trim() || 'Active',
            higherEducation: row.highestDegree ? [{
              degree: row.highestDegree.trim(),
              fieldOfStudy: row.specialization?.trim() || '',
              isCompleted: true
            }] : []
          }
        };

        const newUser = await User.create(userData);

        results.success.push({
          row: rowNum,
          email: row.email,
          name: `${row.firstName} ${row.lastName}`,
          temporaryPassword: password
        });

      } catch (err) {
        results.failed.push({
          row: rowNum,
          email: row.email || 'N/A',
          reason: err.message
        });
      }
    }

    // Create notification for manager about bulk upload
    if (results.success.length > 0) {
      const managers = await User.find({ role: 'manager' });
      for (const manager of managers) {
        await Notification.create({
          user: manager._id,
          title: 'Bulk Student Upload',
          message: `${results.success.length} new students were added via bulk upload by ${req.user.firstName} ${req.user.lastName}`,
          type: 'info'
        });
      }
    }

    res.json({
      message: 'Bulk upload completed',
      summary: {
        total: rows.length,
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      results
    });

  } catch (error) {
    console.error('Bulk upload students error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST bulk upload self-applications (for students)
router.post('/self-applications', auth, authorize('student'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const rows = await parseCSV(req.file.buffer);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    // Validate required columns
    const requiredColumns = ['companyName', 'jobTitle'];
    const csvColumns = Object.keys(rows[0]);
    const missingColumns = requiredColumns.filter(col => !csvColumns.includes(col));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    const validStatuses = ['applied', 'in_progress', 'interview_scheduled', 'offer_received', 'offer_accepted', 'offer_declined', 'rejected', 'withdrawn'];

    const results = {
      success: [],
      failed: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const status = row.status?.toLowerCase()?.trim() || 'applied';

        if (!validStatuses.includes(status)) {
          results.failed.push({
            row: rowNum,
            company: row.companyName,
            reason: `Invalid status: ${status}`
          });
          continue;
        }

        const applicationData = {
          student: req.user.id,
          campus: req.user.campus,
          companyName: row.companyName?.trim(),
          jobTitle: row.jobTitle?.trim(),
          jobUrl: row.jobUrl?.trim() || '',
          location: row.location?.trim() || '',
          salary: row.salary?.trim() || '',
          applicationDate: row.applicationDate ? new Date(row.applicationDate) : new Date(),
          status,
          source: row.source?.trim() || '',
          notes: row.notes?.trim() || '',
          statusHistory: [{
            status,
            changedAt: new Date(),
            notes: 'Imported via bulk upload'
          }]
        };

        const newApp = await SelfApplication.create(applicationData);

        results.success.push({
          row: rowNum,
          company: row.companyName,
          jobTitle: row.jobTitle,
          id: newApp._id
        });

      } catch (err) {
        results.failed.push({
          row: rowNum,
          company: row.companyName || 'N/A',
          reason: err.message
        });
      }
    }

    res.json({
      message: 'Bulk upload completed',
      summary: {
        total: rows.length,
        success: results.success.length,
        failed: results.failed.length
      },
      results
    });

  } catch (error) {
    console.error('Bulk upload self-applications error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST bulk upload self-applications by Campus PoC (for their students)
router.post('/self-applications/campus', auth, authorize('campus_poc'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const rows = await parseCSV(req.file.buffer);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    // Validate required columns
    const requiredColumns = ['studentEmail', 'companyName', 'jobTitle'];
    const csvColumns = Object.keys(rows[0]);
    const missingColumns = requiredColumns.filter(col => !csvColumns.includes(col));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    // Get students from this campus
    const campusStudents = await User.find({
      campus: req.user.campus,
      role: 'student'
    }).select('_id email');

    const studentMap = {};
    campusStudents.forEach(s => {
      studentMap[s.email.toLowerCase()] = s._id;
    });

    const validStatuses = ['applied', 'in_progress', 'interview_scheduled', 'offer_received', 'offer_accepted', 'offer_declined', 'rejected', 'withdrawn'];

    const results = {
      success: [],
      failed: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const studentEmail = row.studentEmail?.toLowerCase()?.trim();
        const studentId = studentMap[studentEmail];

        if (!studentId) {
          results.failed.push({
            row: rowNum,
            email: studentEmail,
            reason: 'Student not found in your campus'
          });
          continue;
        }

        const status = row.status?.toLowerCase()?.trim() || 'applied';

        if (!validStatuses.includes(status)) {
          results.failed.push({
            row: rowNum,
            email: studentEmail,
            reason: `Invalid status: ${status}`
          });
          continue;
        }

        const applicationData = {
          student: studentId,
          campus: req.user.campus,
          companyName: row.companyName?.trim(),
          jobTitle: row.jobTitle?.trim(),
          jobUrl: row.jobUrl?.trim() || '',
          location: row.location?.trim() || '',
          salary: row.salary?.trim() || '',
          applicationDate: row.applicationDate ? new Date(row.applicationDate) : new Date(),
          status,
          source: row.source?.trim() || '',
          notes: row.notes?.trim() || '',
          verified: true, // Auto-verify since uploaded by PoC
          verifiedBy: req.user.id,
          verifiedAt: new Date(),
          statusHistory: [{
            status,
            changedAt: new Date(),
            notes: 'Imported via bulk upload by Campus PoC'
          }]
        };

        const newApp = await SelfApplication.create(applicationData);

        results.success.push({
          row: rowNum,
          email: studentEmail,
          company: row.companyName,
          jobTitle: row.jobTitle,
          id: newApp._id
        });

      } catch (err) {
        results.failed.push({
          row: rowNum,
          email: row.studentEmail || 'N/A',
          reason: err.message
        });
      }
    }

    res.json({
      message: 'Bulk upload completed',
      summary: {
        total: rows.length,
        success: results.success.length,
        failed: results.failed.length
      },
      results
    });

  } catch (error) {
    console.error('Bulk upload campus self-applications error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET sample CSV for campus PoC self-applications
router.get('/sample/self-applications-campus', auth, authorize('campus_poc'), (req, res) => {
  const csvContent = `studentEmail,companyName,jobTitle,jobUrl,location,salary,applicationDate,status,source,notes
student1@navgurukul.org,Google,Software Engineer,https://careers.google.com/job123,Bangalore,25 LPA,2024-01-15,offer_received,LinkedIn,
student2@navgurukul.org,Microsoft,Frontend Developer,https://careers.microsoft.com/job456,Remote,20 LPA,2024-01-10,applied,Referral,
student3@navgurukul.org,Amazon,SDE-1,https://amazon.jobs/job789,Hyderabad,22 LPA,2024-01-05,interview_scheduled,Naukri,Round 2 scheduled`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=self_applications_campus_sample.csv');
  res.send(csvContent);
});

// GET sample CSV for attendance bulk upload
router.get('/sample/attendance', auth, authorize('campus_poc', 'coordinator', 'manager'), (req, res) => {
  const csvContent = `email,attendancePercentage,dateOfJoining
student1@navgurukul.org,85.5,2024-01-15
student2@navgurukul.org,92.0,2024-02-01
student3@navgurukul.org,78.0,2023-11-20`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=attendance_sample.csv');
  res.send(csvContent);
});

// POST bulk upload attendance data
router.post('/attendance', auth, authorize('campus_poc', 'coordinator', 'manager'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const rows = await parseCSV(req.file.buffer);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    // Validate required columns
    const requiredColumns = ['email'];
    const csvColumns = Object.keys(rows[0]);
    const missingColumns = requiredColumns.filter(col => !csvColumns.includes(col));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    // For campus POC, only allow updating their campus students
    const query = { role: 'student' };
    if (req.user.role === 'campus_poc') {
      query.campus = req.user.campus;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const email = row.email?.toLowerCase()?.trim();

        if (!email) {
          results.failed.push({
            row: rowNum,
            email: 'N/A',
            reason: 'Email is required'
          });
          continue;
        }

        // Find student
        const student = await User.findOne({ ...query, email });

        if (!student) {
          results.failed.push({
            row: rowNum,
            email,
            reason: req.user.role === 'campus_poc'
              ? 'Student not found in your campus'
              : 'Student not found'
          });
          continue;
        }

        // Update attendance and/or joining date
        const updates = {};

        if (row.attendancePercentage !== undefined && row.attendancePercentage !== '') {
          const attendance = parseFloat(row.attendancePercentage);
          if (isNaN(attendance) || attendance < 0 || attendance > 100) {
            results.failed.push({
              row: rowNum,
              email,
              reason: 'Invalid attendance percentage (must be 0-100)'
            });
            continue;
          }
          updates['studentProfile.attendancePercentage'] = attendance;
        }

        if (row.dateOfJoining) {
          const joinDate = new Date(row.dateOfJoining);
          if (isNaN(joinDate.getTime())) {
            results.failed.push({
              row: rowNum,
              email,
              reason: 'Invalid date format for dateOfJoining'
            });
            continue;
          }
          updates['studentProfile.dateOfJoining'] = joinDate;
        }

        if (Object.keys(updates).length === 0) {
          results.skipped.push({
            row: rowNum,
            email,
            reason: 'No valid fields to update'
          });
          continue;
        }

        await User.findByIdAndUpdate(student._id, { $set: updates });

        results.success.push({
          row: rowNum,
          email,
          name: `${student.firstName} ${student.lastName}`,
          updates: Object.keys(updates).map(k => k.replace('studentProfile.', ''))
        });

      } catch (err) {
        results.failed.push({
          row: rowNum,
          email: row.email || 'N/A',
          reason: err.message
        });
      }
    }

    res.json({
      message: 'Attendance data upload completed',
      summary: {
        total: rows.length,
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      results
    });

  } catch (error) {
    console.error('Bulk upload attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
