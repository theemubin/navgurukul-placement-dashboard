const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Campus = require('../models/Campus');
const { auth, authorize } = require('../middleware/auth');

// Get dashboard stats (Managers and Coordinators)
router.get('/dashboard', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { campus } = req.query;

    // Base queries
    let studentQuery = { role: 'student', isActive: true };
    let applicationQuery = {};

    if (campus) {
      studentQuery.campus = campus;
      const campusStudents = await User.find(studentQuery).select('_id');
      applicationQuery.student = { $in: campusStudents.map(s => s._id) };
    }

    // Get counts
    const totalStudents = await User.countDocuments(studentQuery);
    const totalJobs = await Job.countDocuments({ status: 'active' });
    const totalApplications = await Application.countDocuments(applicationQuery);
    const totalPlacements = await Application.countDocuments({ ...applicationQuery, status: 'selected' });

    // Get active companies
    const activeJobs = await Job.find({ status: 'active' }).distinct('company.name');
    const activeCompanies = activeJobs.length;

    // Applications by status
    const applicationsByStatus = await Application.aggregate([
      { $match: applicationQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Placements by campus
    const placementsByCampus = await Application.aggregate([
      { $match: { status: 'selected' } },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'studentData'
        }
      },
      { $unwind: '$studentData' },
      {
        $lookup: {
          from: 'campuses',
          localField: 'studentData.campus',
          foreignField: '_id',
          as: 'campusData'
        }
      },
      { $unwind: { path: '$campusData', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$campusData._id',
          campusName: { $first: '$campusData.name' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Placements by job type
    const placementsByJobType = await Application.aggregate([
      { $match: { status: 'selected' } },
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          as: 'jobData'
        }
      },
      { $unwind: '$jobData' },
      {
        $group: {
          _id: '$jobData.jobType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent placements
    const recentPlacements = await Application.find({ status: 'selected' })
      .populate('student', 'firstName lastName')
      .populate('job', 'title company.name')
      .sort({ updatedAt: -1 })
      .limit(5);

    // Top companies by placements
    const topCompanies = await Application.aggregate([
      { $match: { status: 'selected' } },
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          as: 'jobData'
        }
      },
      { $unwind: '$jobData' },
      {
        $group: {
          _id: '$jobData.company.name',
          placements: { $sum: 1 }
        }
      },
      { $sort: { placements: -1 } },
      { $limit: 5 }
    ]);

    // Monthly placement trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await Application.aggregate([
      { 
        $match: { 
          status: 'selected',
          updatedAt: { $gte: sixMonthsAgo }
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      summary: {
        totalStudents,
        totalJobs,
        totalApplications,
        totalPlacements,
        activeCompanies,
        placementRate: totalStudents > 0 
          ? Math.round((totalPlacements / totalStudents) * 100) 
          : 0
      },
      applicationsByStatus: applicationsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      placementsByCampus,
      placementsByJobType,
      recentPlacements,
      topCompanies,
      monthlyTrend
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get campus-wise stats
router.get('/campus', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const campuses = await Campus.find({ isActive: true });
    
    const campusStats = await Promise.all(campuses.map(async (campus) => {
      const students = await User.countDocuments({ 
        role: 'student', 
        campus: campus._id,
        isActive: true 
      });

      const studentIds = await User.find({ 
        role: 'student', 
        campus: campus._id 
      }).select('_id');

      const placements = await Application.countDocuments({
        student: { $in: studentIds.map(s => s._id) },
        status: 'selected'
      });

      return {
        campus: {
          id: campus._id,
          name: campus.name,
          code: campus.code
        },
        students,
        placements,
        target: campus.placementTarget,
        progress: campus.placementTarget > 0 
          ? Math.round((placements / campus.placementTarget) * 100)
          : 0
      };
    }));

    res.json(campusStats);
  } catch (error) {
    console.error('Get campus stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Export stats as CSV
router.get('/export', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { type = 'placements', campus } = req.query;

    let data = [];
    let headers = [];

    if (type === 'placements') {
      headers = ['Student Name', 'Email', 'Campus', 'Company', 'Job Title', 'Job Type', 'Placement Date'];
      
      let query = { status: 'selected' };
      if (campus) {
        const campusStudents = await User.find({ campus }).select('_id');
        query.student = { $in: campusStudents.map(s => s._id) };
      }

      const placements = await Application.find(query)
        .populate('student', 'firstName lastName email campus')
        .populate({
          path: 'student',
          populate: { path: 'campus', select: 'name' }
        })
        .populate('job', 'title company.name jobType');

      data = placements.map(p => [
        `${p.student.firstName} ${p.student.lastName}`,
        p.student.email,
        p.student.campus?.name || '',
        p.job.company.name,
        p.job.title,
        p.job.jobType,
        p.updatedAt.toISOString().split('T')[0]
      ]);
    } else if (type === 'students') {
      headers = ['Name', 'Email', 'Enrollment No', 'Department', 'Batch', 'CGPA', 'Campus', 'Placement Status'];
      
      let query = { role: 'student' };
      if (campus) query.campus = campus;

      const students = await User.find(query)
        .populate('campus', 'name');

      for (const student of students) {
        const placement = await Application.findOne({
          student: student._id,
          status: 'selected'
        });

        data.push([
          `${student.firstName} ${student.lastName}`,
          student.email,
          student.studentProfile?.enrollmentNumber || '',
          student.studentProfile?.department || '',
          student.studentProfile?.batch || '',
          student.studentProfile?.cgpa || '',
          student.campus?.name || '',
          placement ? 'Placed' : 'Not Placed'
        ]);
      }
    }

    const csv = [headers, ...data].map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-export.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Student dashboard stats
router.get('/student', auth, authorize('student'), async (req, res) => {
  try {
    const applications = await Application.find({ student: req.userId })
      .populate('job', 'title company.name status');

    const stats = {
      totalApplications: applications.length,
      inProgress: applications.filter(a => ['applied', 'shortlisted', 'in_progress'].includes(a.status)).length,
      selected: applications.filter(a => a.status === 'selected').length,
      rejected: applications.filter(a => a.status === 'rejected').length
    };

    const recentApplications = applications
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    res.json({ stats, recentApplications });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Coordinator stats - Which coordinator is handling how many jobs
router.get('/coordinator-stats', auth, authorize('manager'), async (req, res) => {
  try {
    // Get all coordinators
    const coordinators = await User.find({ 
      role: 'coordinator', 
      isActive: true 
    }).select('firstName lastName email');

    // Get jobs stats by coordinator
    const coordinatorStats = await Promise.all(coordinators.map(async (coordinator) => {
      // Jobs assigned to this coordinator
      const assignedJobs = await Job.countDocuments({
        assignedCoordinator: coordinator._id
      });

      // Jobs created by this coordinator
      const createdJobs = await Job.countDocuments({
        createdBy: coordinator._id
      });

      // Active jobs
      const activeJobs = await Job.countDocuments({
        $or: [
          { assignedCoordinator: coordinator._id },
          { createdBy: coordinator._id }
        ],
        status: 'active'
      });

      // Get applications for jobs handled by this coordinator
      const coordinatorJobs = await Job.find({
        $or: [
          { assignedCoordinator: coordinator._id },
          { createdBy: coordinator._id }
        ]
      }).select('_id');

      const jobIds = coordinatorJobs.map(j => j._id);

      const applications = await Application.countDocuments({
        job: { $in: jobIds }
      });

      const placements = await Application.countDocuments({
        job: { $in: jobIds },
        status: 'selected'
      });

      return {
        coordinator: {
          id: coordinator._id,
          name: `${coordinator.firstName} ${coordinator.lastName}`,
          email: coordinator.email
        },
        assignedJobs,
        createdJobs,
        totalJobs: assignedJobs || createdJobs, // whichever is used
        activeJobs,
        totalApplications: applications,
        placements,
        conversionRate: applications > 0 
          ? Math.round((placements / applications) * 100) 
          : 0
      };
    }));

    // Sort by total jobs descending
    coordinatorStats.sort((a, b) => b.totalJobs - a.totalJobs);

    res.json(coordinatorStats);
  } catch (error) {
    console.error('Get coordinator stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Campus POC dashboard stats
router.get('/campus-poc', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusId = req.user.campus;

    const students = await User.find({ 
      role: 'student', 
      campus: campusId,
      isActive: true 
    });

    const studentIds = students.map(s => s._id);

    // Pending skill approvals
    const pendingSkills = students.reduce((count, student) => {
      return count + (student.studentProfile?.skills?.filter(s => s.status === 'pending').length || 0);
    }, 0);

    // Pending profile approvals
    const pendingProfiles = students.filter(s => 
      s.studentProfile?.profileStatus === 'pending_approval'
    ).length;

    // Application stats
    const applications = await Application.find({
      student: { $in: studentIds }
    });

    const placements = applications.filter(a => a.status === 'selected').length;

    res.json({
      totalStudents: students.length,
      pendingSkillApprovals: pendingSkills,
      pendingProfileApprovals: pendingProfiles,
      totalApplications: applications.length,
      totalPlacements: placements,
      placementRate: students.length > 0 
        ? Math.round((placements / students.length) * 100) 
        : 0
    });
  } catch (error) {
    console.error('Get campus POC stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Company-wise application tracking for POC
router.get('/campus-poc/company-tracking', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusId = req.user.campus;
    const { cycleId } = req.query;

    // Get students for this campus (optionally filtered by cycle)
    let studentQuery = { 
      role: 'student', 
      campus: campusId,
      isActive: true 
    };

    if (cycleId) {
      studentQuery.placementCycle = cycleId;
    }

    const students = await User.find(studentQuery).select('_id');
    const studentIds = students.map(s => s._id);

    // Get all applications for these students with job details
    const applications = await Application.find({
      student: { $in: studentIds }
    })
      .populate('student', 'firstName lastName email studentProfile.currentSchool')
      .populate('job', 'title company.name company.logo jobType status interviewRounds');

    // Group by company
    const companyMap = {};
    applications.forEach(app => {
      const companyName = app.job?.company?.name || 'Unknown';
      if (!companyMap[companyName]) {
        companyMap[companyName] = {
          company: companyName,
          logo: app.job?.company?.logo,
          jobs: {},
          totalApplications: 0,
          statusCounts: {
            applied: 0,
            shortlisted: 0,
            in_progress: 0,
            selected: 0,
            rejected: 0,
            withdrawn: 0
          }
        };
      }
      
      companyMap[companyName].totalApplications++;
      companyMap[companyName].statusCounts[app.status]++;
      
      // Group by job within company
      const jobTitle = app.job?.title || 'Unknown';
      if (!companyMap[companyName].jobs[jobTitle]) {
        companyMap[companyName].jobs[jobTitle] = {
          jobId: app.job?._id,
          title: jobTitle,
          jobType: app.job?.jobType,
          applications: []
        };
      }
      
      companyMap[companyName].jobs[jobTitle].applications.push({
        applicationId: app._id,
        studentId: app.student?._id,
        studentName: `${app.student?.firstName} ${app.student?.lastName}`,
        studentEmail: app.student?.email,
        school: app.student?.studentProfile?.currentSchool,
        status: app.status,
        currentRound: app.currentRound,
        totalRounds: app.job?.interviewRounds?.length || 0,
        roundResults: app.roundResults,
        appliedAt: app.createdAt,
        lastUpdated: app.updatedAt
      });
    });

    // Convert to array and sort by total applications
    const companyTracking = Object.values(companyMap)
      .map(company => ({
        ...company,
        jobs: Object.values(company.jobs)
      }))
      .sort((a, b) => b.totalApplications - a.totalApplications);

    res.json(companyTracking);
  } catch (error) {
    console.error('Get company tracking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// School-wise (Navgurukul schools) application tracking for POC
router.get('/campus-poc/school-tracking', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusId = req.user.campus;
    const { cycleId } = req.query;

    let studentQuery = { 
      role: 'student', 
      campus: campusId,
      isActive: true 
    };

    if (cycleId) {
      studentQuery.placementCycle = cycleId;
    }

    const students = await User.find(studentQuery)
      .select('firstName lastName email studentProfile.currentSchool placementCycle')
      .populate('placementCycle', 'name');

    const studentIds = students.map(s => s._id);

    // Get all applications
    const applications = await Application.find({
      student: { $in: studentIds }
    }).populate('job', 'title company.name');

    // Create student map for quick lookup
    const studentMap = {};
    students.forEach(s => {
      studentMap[s._id.toString()] = s;
    });

    // Group by school
    const schoolMap = {};
    const schools = ['School of Programming', 'School of Business', 'School of Finance', 'School of Education', 'School of Second Chance', 'Unassigned'];
    
    schools.forEach(school => {
      schoolMap[school] = {
        school,
        students: [],
        totalStudents: 0,
        totalApplications: 0,
        placed: 0,
        inProgress: 0,
        rejected: 0
      };
    });

    // Populate school data
    students.forEach(student => {
      const school = student.studentProfile?.currentSchool || 'Unassigned';
      const studentApps = applications.filter(a => a.student.toString() === student._id.toString());
      
      const placed = studentApps.some(a => a.status === 'selected');
      const inProgress = studentApps.some(a => ['applied', 'shortlisted', 'in_progress'].includes(a.status));

      schoolMap[school].students.push({
        studentId: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        cycle: student.placementCycle?.name,
        applicationCount: studentApps.length,
        status: placed ? 'placed' : (inProgress ? 'in_progress' : (studentApps.length > 0 ? 'rejected' : 'not_applied')),
        applications: studentApps.map(a => ({
          company: a.job?.company?.name,
          job: a.job?.title,
          status: a.status
        }))
      });

      schoolMap[school].totalStudents++;
      schoolMap[school].totalApplications += studentApps.length;
      if (placed) schoolMap[school].placed++;
      else if (inProgress) schoolMap[school].inProgress++;
      else if (studentApps.some(a => a.status === 'rejected')) schoolMap[school].rejected++;
    });

    // Convert to array and filter out empty schools
    const schoolTracking = Object.values(schoolMap).filter(s => s.totalStudents > 0);

    res.json(schoolTracking);
  } catch (error) {
    console.error('Get school tracking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Student application summary for POC (quick overview)
router.get('/campus-poc/student-summary', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusId = req.user.campus;
    const { cycleId, status, school } = req.query;

    let studentQuery = { 
      role: 'student', 
      campus: campusId,
      isActive: true 
    };

    if (cycleId) {
      studentQuery.placementCycle = cycleId;
    }

    if (school) {
      studentQuery['studentProfile.currentSchool'] = school;
    }

    const students = await User.find(studentQuery)
      .select('firstName lastName email studentProfile.currentSchool studentProfile.profileStatus placementCycle')
      .populate('placementCycle', 'name')
      .populate('campus', 'name');

    // Get applications for all students
    const studentIds = students.map(s => s._id);
    const applications = await Application.find({
      student: { $in: studentIds }
    })
      .populate('job', 'title company.name jobType applicationDeadline')
      .sort({ updatedAt: -1 });

    // Build summary for each student
    const studentSummaries = students.map(student => {
      const studentApps = applications.filter(a => a.student.toString() === student._id.toString());
      const selectedApp = studentApps.find(a => a.status === 'selected');
      const inProgressApps = studentApps.filter(a => ['applied', 'shortlisted', 'in_progress'].includes(a.status));
      
      let placementStatus = 'not_applied';
      if (selectedApp) placementStatus = 'placed';
      else if (inProgressApps.length > 0) placementStatus = 'in_progress';
      else if (studentApps.length > 0) placementStatus = 'rejected';

      return {
        studentId: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        school: student.studentProfile?.currentSchool || 'Not Assigned',
        profileStatus: student.studentProfile?.profileStatus || 'draft',
        cycle: student.placementCycle?.name || 'Not Assigned',
        placementStatus,
        placedAt: selectedApp?.job?.company?.name || null,
        totalApplications: studentApps.length,
        activeApplications: inProgressApps.length,
        applications: studentApps.slice(0, 5).map(a => ({
          applicationId: a._id,
          company: a.job?.company?.name,
          job: a.job?.title,
          jobType: a.job?.jobType,
          status: a.status,
          deadline: a.job?.applicationDeadline,
          appliedAt: a.createdAt,
          lastUpdated: a.updatedAt
        }))
      };
    });

    // Filter by status if provided
    let filteredSummaries = studentSummaries;
    if (status) {
      filteredSummaries = studentSummaries.filter(s => s.placementStatus === status);
    }

    // Sort: placed first, then by active applications
    filteredSummaries.sort((a, b) => {
      if (a.placementStatus === 'placed' && b.placementStatus !== 'placed') return -1;
      if (a.placementStatus !== 'placed' && b.placementStatus === 'placed') return 1;
      return b.activeApplications - a.activeApplications;
    });

    res.json({
      summary: {
        total: studentSummaries.length,
        placed: studentSummaries.filter(s => s.placementStatus === 'placed').length,
        inProgress: studentSummaries.filter(s => s.placementStatus === 'in_progress').length,
        notApplied: studentSummaries.filter(s => s.placementStatus === 'not_applied').length,
        rejected: studentSummaries.filter(s => s.placementStatus === 'rejected').length
      },
      students: filteredSummaries
    });
  } catch (error) {
    console.error('Get student summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get cycle-wise stats for POC
router.get('/campus-poc/cycle-stats', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusId = req.user.campus;
    const PlacementCycle = require('../models/PlacementCycle');

    const cycles = await PlacementCycle.find({ campus: campusId })
      .sort({ year: -1, month: -1 });

    const cycleStats = await Promise.all(cycles.map(async (cycle) => {
      const students = await User.find({
        role: 'student',
        placementCycle: cycle._id
      }).select('_id');

      const studentIds = students.map(s => s._id);

      const applications = await Application.find({
        student: { $in: studentIds }
      });

      const placed = applications.filter(a => a.status === 'selected').length;
      const inProgress = applications.filter(a => ['applied', 'shortlisted', 'in_progress'].includes(a.status)).length;

      return {
        cycleId: cycle._id,
        name: cycle.name,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
        targetPlacements: cycle.targetPlacements,
        students: students.length,
        applications: applications.length,
        placed,
        inProgress,
        progress: cycle.targetPlacements > 0 
          ? Math.round((placed / cycle.targetPlacements) * 100)
          : (students.length > 0 ? Math.round((placed / students.length) * 100) : 0)
      };
    }));

    res.json(cycleStats);
  } catch (error) {
    console.error('Get cycle stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
