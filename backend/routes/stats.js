const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Campus = require('../models/Campus');
const PlacementCycle = require('../models/PlacementCycle');
const { StudentJobReadiness } = require('../models/JobReadiness');
const { auth, authorize } = require('../middleware/auth');

// Helper to get all campus IDs a POC is authorized to manage
const getPOCManagedCampusIds = (user) => {
  const ids = (user.managedCampuses || []).map(id => id.toString());
  if (user.campus) ids.push(user.campus.toString());
  return [...new Set(ids)];
};

/**
 * @swagger
 * tags:
 *   name: Stats
 *   description: Statistics, reporting, and analytics
 */

// Get detailed reports and analytics
/**
 * @swagger
 * /api/stats/reports:
 *   get:
 *     summary: Get detailed analytical reports (Manager only)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analytical data
 */
router.get('/reports', auth, authorize('manager'), async (req, res) => {
  try {
    const { dateRange = 'year' } = req.query;

    // Set up date filter based on range
    const now = new Date();
    let dateFilter = {};
    if (dateRange === 'year') {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), 0, 1) } };
    } else if (dateRange === 'quarter') {
      const quarterStart = new Date();
      quarterStart.setMonth(now.getMonth() - 3);
      dateFilter = { createdAt: { $gte: quarterStart } };
    } else if (dateRange === 'month') {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
    }

    // 1. Basic Stats
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const placedStudents = await Application.countDocuments({ status: 'selected' });
    const totalJobs = await Job.countDocuments({});
    const totalCompaniesCount = (await Job.distinct('company.name')).length;

    // 2. Monthly Placement Trend (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const monthlyDataRaw = await Application.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' },
            isPlacement: { $eq: ['$status', 'selected'] }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format monthly data for frontend
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(now.getMonth() - (11 - i));
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const apps = monthlyDataRaw.filter(v => v._id.month === m && v._id.year === y);
      const placements = apps.find(v => v._id.isPlacement)?.count || 0;
      const totalApps = apps.reduce((sum, item) => sum + item.count, 0);

      monthlyTrend.push({
        month: months[m - 1],
        applications: totalApps,
        placements: placements
      });
    }

    // 3. Placement Rate by School
    const schoolStats = await User.aggregate([
      { $match: { role: 'student', isActive: true } },
      {
        $group: {
          _id: '$studentProfile.currentSchool',
          total: { $sum: 1 }
        }
      }
    ]);

    const schoolPerformance = await Promise.all(schoolStats.map(async (school) => {
      if (!school._id) return null;
      const placements = await Application.countDocuments({
        status: 'selected',
        student: { $in: (await User.find({ 'studentProfile.currentSchool': school._id }).select('_id')).map(s => s._id) }
      });
      return {
        school: school._id,
        rate: school.total > 0 ? Math.round((placements / school.total) * 100) : 0,
        students: school.total
      };
    }));

    // 4. Top Recruiting Companies
    const companyStats = await Application.aggregate([
      { $match: { status: 'selected' } },
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          as: 'job'
        }
      },
      { $unwind: '$job' },
      {
        $group: {
          _id: '$job.company.name',
          hires: { $sum: 1 },
          avgSalary: { $avg: '$offerDetails.salary' },
          fallbackSalary: { $avg: '$job.salary.max' }
        }
      },
      { $sort: { hires: -1 } },
      { $limit: 10 }
    ]);

    const topCompanies = companyStats.map((c, i) => ({
      name: c._id,
      hires: c.hires,
      package: c.avgSalary ? `${Math.round(c.avgSalary / 100000)} LPA` : (c.fallbackSalary ? `${Math.round(c.fallbackSalary / 100000)} LPA` : 'N/A')
    }));

    // 5. Campus Performance
    const campusData = await Campus.find({ isActive: true });
    const campusStats = await Promise.all(campusData.map(async (campus) => {
      const students = await User.countDocuments({ role: 'student', campus: campus._id, isActive: true });
      const studentIds = await User.find({ campus: campus._id }).select('_id');
      const placements = await Application.countDocuments({
        student: { $in: studentIds.map(s => s._id) },
        status: 'selected'
      });
      return {
        name: campus.name,
        students,
        placements
      };
    }));

    // 6. Quick Stats
    const salaryStats = await Application.aggregate([
      { $match: { status: 'selected', 'offerDetails.salary': { $gt: 0 } } },
      {
        $group: {
          _id: null,
          max: { $max: '$offerDetails.salary' },
          min: { $min: '$offerDetails.salary' },
          avg: { $avg: '$offerDetails.salary' },
          count: { $sum: 1 }
        }
      }
    ]);

    const ppoOffers = await Application.countDocuments({
      status: 'selected',
      'job.jobType': 'internship' // assuming internship converted to PPO
    });

    const reportData = {
      totalStudents,
      placedStudents,
      totalJobs,
      totalCompaniesCount,
      monthlyTrend,
      schoolPerformance: schoolPerformance.filter(Boolean).sort((a, b) => b.rate - a.rate),
      topCompanies,
      campusStats,
      quickStats: {
        highestPackage: salaryStats[0]?.max ? `${Math.round(salaryStats[0].max / 100000)} LPA` : 'N/A',
        averagePackage: salaryStats[0]?.avg ? `${Math.round(salaryStats[0].avg / 100000)} LPA` : 'N/A',
        lowestPackage: salaryStats[0]?.min ? `${Math.round(salaryStats[0].min / 100000)} LPA` : 'N/A',
        totalOffers: salaryStats[0]?.count || placedStudents,
        ppoOffers: 0, // Placeholder for actual PPO logic if implemented
        dreamCompanies: topCompanies.filter(c => parseFloat(c.package) >= 10).length
      }
    };

    res.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Get report stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Support both legacy 'active' status and new pipeline stages
const activeStatuses = ['active', 'application_stage', 'hr_shortlisting', 'interviewing'];

// Get dashboard stats (Managers and Coordinators)
/**
 * @swagger
 * /api/stats/dashboard:
 *   get:
 *     summary: Get main dashboard statistics
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 */
router.get('/dashboard', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { campus, range } = req.query;

    // Set up date filter based on range
    const now = new Date();
    let dateFilter = {};
    if (range === 'year') {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), 0, 1) } };
    } else if (range === 'month') {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
    } else if (range === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
    }

    // Base queries
    let studentQuery = { role: 'student', isActive: true };
    let applicationQuery = {};
    let jobQuery = {};

    if (Object.keys(dateFilter).length > 0) {
      applicationQuery.createdAt = dateFilter.createdAt;
      jobQuery.createdAt = dateFilter.createdAt;
    }

    if (campus) {
      studentQuery.campus = campus;
      const campusStudents = await User.find(studentQuery).select('_id');
      applicationQuery.student = { $in: campusStudents.map(s => s._id) };
    }

    // Get counts
    const totalStudents = await User.countDocuments(studentQuery);
    const totalJobs = await Job.countDocuments({ ...jobQuery, status: { $in: activeStatuses } });
    const totalApplications = await Application.countDocuments(applicationQuery);
    
    // For placements, we look at updatedAt or status change date if available, 
    // but createdAt with status 'selected' is common too. 
    // Let's use applicationQuery which already has the date filter.
    const totalPlacements = await Application.countDocuments({ ...applicationQuery, status: 'selected' });

    // Get active companies
    const activeJobs = await Job.find({ status: { $in: activeStatuses } }).distinct('company.name');
    const activeCompanies = activeJobs.length;

    const totalCampuses = await Campus.countDocuments({ isActive: true });
    const totalPocs = await User.countDocuments({ role: 'campus_poc', isActive: true });
    const totalCoordinators = await User.countDocuments({ role: 'coordinator', isActive: true });
    const paidProjects = await Job.countDocuments({ jobType: 'paid_project', status: { $in: activeStatuses } });

    // Applications by status
    const applicationsByStatus = await Application.aggregate([
      { $match: applicationQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Placements by campus
    const placementsByCampus = await Application.aggregate([
      { $match: { ...applicationQuery, status: 'selected' } },
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
      { $match: { ...applicationQuery, status: 'selected' } },
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
    const recentPlacements = await Application.find({ ...applicationQuery, status: 'selected' })
      .populate('student', 'firstName lastName')
      .populate('job', 'title company.name')
      .sort({ updatedAt: -1 })
      .limit(5);

    // Top companies by placements
    const topCompanies = await Application.aggregate([
      { $match: { ...applicationQuery, status: 'selected' } },
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
        activeJobs: totalJobs,
        paidProjects,
        totalApplications,
        totalPlacements,
        activeCompanies,
        totalCampuses,
        totalPocs,
        totalCoordinators,
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
/**
 * @swagger
 * /api/stats/campus:
 *   get:
 *     summary: Get campus-wise statistics
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: campusId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campus stats
 */
router.get('/campus', auth, authorize('coordinator', 'manager'), async (req, res) => {
  try {
    const { range, campusId } = req.query;

    // Set up date filter based on range
    const now = new Date();
    let dateFilter = {};
    if (range === 'year') {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), 0, 1) } };
    } else if (range === 'month') {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
    } else if (range === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
    }

    const campusFilter = { isActive: true };
    if (campusId) {
      campusFilter._id = campusId;
    }

    const campuses = await Campus.find(campusFilter);

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

      const placementFilter = {
        student: { $in: studentIds.map(s => s._id) },
        status: 'selected'
      };

      if (Object.keys(dateFilter).length > 0) {
        placementFilter.createdAt = dateFilter.createdAt;
      }

      const placements = await Application.countDocuments(placementFilter);

      // Count job-ready students for this campus
      let jobReadyCount = 0;
      let jobReadyBySchool = [];
      try {
        jobReadyCount = await StudentJobReadiness.countDocuments({ campus: campus._id, isJobReady: true });

        // Count job-ready students per school for this campus
        jobReadyBySchool = await StudentJobReadiness.aggregate([
          { $match: { campus: campus._id, isJobReady: true } },
          { $group: { _id: '$school', count: { $sum: 1 } } },
          { $project: { school: '$_id', count: 1, _id: 0 } }
        ]);
      } catch (e) {
        console.error('Error counting job ready for campus', campus._id, e);
      }

      return {
        campus: {
          id: campus._id,
          name: campus.name,
          code: campus.code
        },
        students,
        placements,
        jobReadyCount,
        jobReadyBySchool,
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
/**
 * @swagger
 * /api/stats/export:
 *   get:
 *     summary: Export statistical data
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export successful
 */
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
      headers = ['Name', 'Email', 'Enrollment No', 'Department', 'Batch', 'CGPA', 'Campus', 'LinkedIn', 'GitHub', 'Portfolio', 'Placement Status'];

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
          student.studentProfile?.linkedIn || '',
          student.studentProfile?.github || '',
          student.studentProfile?.portfolio || '',
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
/**
 * @swagger
 * /api/stats/student:
 *   get:
 *     summary: Get statistics for authenticated student
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student stats
 */
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
/**
 * @swagger
 * /api/stats/coordinator-stats:
 *   get:
 *     summary: Get coordinator performance stats
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance data
 */
router.get('/coordinator-stats', auth, authorize('manager'), async (req, res) => {
  try {
    const { range, campus } = req.query;

    // Set up date filter based on range
    const now = new Date();
    let dateFilter = {};
    if (range === 'year') {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), 0, 1) } };
    } else if (range === 'month') {
      dateFilter = { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
    } else if (range === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
    }

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

      // Active jobs - support both legacy 'active' and pipeline stages
      const activeStatuses = ['active', 'application_stage', 'hr_shortlisting', 'interviewing'];
      const activeJobs = await Job.countDocuments({
        $or: [
          { assignedCoordinator: coordinator._id },
          { createdBy: coordinator._id }
        ],
        status: { $in: activeStatuses }
      });

      // Get applications for jobs handled by this coordinator
      let coordinatorJobQuery = {
        $or: [
          { assignedCoordinator: coordinator._id },
          { createdBy: coordinator._id }
        ]
      };

      const coordinatorJobs = await Job.find(coordinatorJobQuery).select('_id');
      const jobIds = coordinatorJobs.map(j => j._id);

      const applicationFilter = { job: { $in: jobIds } };
      const placementFilter = { job: { $in: jobIds }, status: 'selected' };

      if (campus) {
        const campusStudents = await User.find({ campus, role: 'student' }).select('_id');
        const campusStudentIds = campusStudents.map(s => s._id);
        applicationFilter.student = { $in: campusStudentIds };
        placementFilter.student = { $in: campusStudentIds };
      }

      if (Object.keys(dateFilter).length > 0) {
        applicationFilter.createdAt = dateFilter.createdAt;
        placementFilter.createdAt = dateFilter.createdAt;
      }

      const applications = await Application.countDocuments(applicationFilter);
      const placements = await Application.countDocuments(placementFilter);

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
/**
 * @swagger
 * /api/stats/campus-poc:
 *   get:
 *     summary: Get main POC dashboard statistics
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: POC dashboard stats
 */
router.get('/campus-poc', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    const { status: filterStatus } = req.query; // Filter by Active/Placed etc

    let studentQuery = {
      role: 'student',
      campus: { $in: campusIds },
      isActive: true
    };

    if (filterStatus) {
      studentQuery['studentProfile.currentStatus'] = filterStatus;
    }

    const students = await User.find(studentQuery);

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

    // Student status counts
    const statusCounts = {
      'Active': 0,
      'In active': 0,
      'Long Leave': 0,
      'Dropout': 0,
      'Placed': 0
    };

    students.forEach(s => {
      const status = s.studentProfile?.currentStatus || 'Active';
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
    });

    // Readiness pool stats
    const readinessRecords = await StudentJobReadiness.find({
      student: { $in: studentIds }
    });

    const readinessPool = {
      'Job Ready': 0,
      'Job Ready Under Process': 0,
      'Not Job Ready': 0
    };

    readinessRecords.forEach(record => {
      const status = record.readinessStatus || 'Not Job Ready';
      if (readinessPool[status] !== undefined) {
        readinessPool[status]++;
      }
    });

    // Interest count
    const interestCount = await Application.countDocuments({
      student: { $in: studentIds },
      applicationType: 'interest'
    });

    res.json({
      totalStudents: students.length,
      pendingSkillApprovals: pendingSkills,
      pendingProfileApprovals: pendingProfiles,
      totalApplications: applications.length,
      totalPlacements: placements,
      placementRate: students.length > 0
        ? Math.round((placements / students.length) * 100)
        : 0,
      statusCounts,
      readinessPool,
      interestCount
    });
  } catch (error) {
    console.error('Get campus POC stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get eligible students for a specific job (Campus POC)
/**
 * @swagger
 * /api/stats/campus-poc/job/{jobId}/eligible-students:
 *   get:
 *     summary: List eligible students for a job in POC's campus
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of eligible students
 */
router.get('/campus-poc/job/:jobId/eligible-students', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    const { jobId } = req.params;

    // Get the job
    const job = await Job.findById(jobId)
      .populate('requiredSkills.skill', 'name category');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Get students for this campus
    const students = await User.find({
      role: 'student',
      campus: { $in: campusIds },
      isActive: true,
      'studentProfile.profileStatus': 'approved'
    })
      .populate('studentProfile.skills.skill', 'name')
      .select('firstName lastName email studentProfile.currentSchool studentProfile.enrollmentNumber studentProfile.skills studentProfile.academicRecords');

    // Check if each student has already applied
    const applicationMap = {};
    const applications = await Application.find({
      job: jobId,
      student: { $in: students.map(s => s._id) }
    }).select('student status');

    applications.forEach(app => {
      applicationMap[app.student.toString()] = app.status;
    });

    // Build student list with match info
    const eligibleStudents = students.map(student => {
      const studentSkillIds = (student.studentProfile?.skills || [])
        .filter(s => s.verified)
        .map(s => s.skill?._id?.toString())
        .filter(Boolean);

      const requiredSkillIds = (job.requiredSkills || [])
        .filter(s => s.isRequired)
        .map(s => s.skill?._id?.toString())
        .filter(Boolean);

      const matchedSkills = studentSkillIds.filter(id => requiredSkillIds.includes(id)).length;
      const totalRequired = requiredSkillIds.length;
      const skillMatch = totalRequired > 0 ? Math.round((matchedSkills / totalRequired) * 100) : 100;

      return {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        school: student.studentProfile?.currentSchool,
        enrollmentNumber: student.studentProfile?.enrollmentNumber,
        skillMatch,
        matchedSkills,
        totalRequired,
        applicationStatus: applicationMap[student._id.toString()] || null,
        hasApplied: !!applicationMap[student._id.toString()]
      };
    });

    // Sort by skill match descending, then by name
    eligibleStudents.sort((a, b) => {
      if (b.skillMatch !== a.skillMatch) return b.skillMatch - a.skillMatch;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });

    res.json({
      job: {
        _id: job._id,
        title: job.title,
        company: job.company?.name
      },
      students: eligibleStudents,
      total: eligibleStudents.length,
      applied: eligibleStudents.filter(s => s.hasApplied).length,
      notApplied: eligibleStudents.filter(s => !s.hasApplied).length
    });
  } catch (error) {
    console.error('Get eligible students for job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all eligible active jobs for Campus POC (jobs their students can apply to)
/**
 * @swagger
 * /api/stats/campus-poc/eligible-jobs:
 *   get:
 *     summary: Get jobs eligible for POC's students
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cycleId
 *         schema:
 *           type: string
 *         description: Optional placement cycle ID to filter jobs
 *     responses:
 *       200:
 *         description: List of eligible jobs
 */
router.get('/campus-poc/eligible-jobs', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    // Support both legacy 'active' and pipeline stages
    const activeStatuses = ['active', 'application_stage', 'hr_shortlisting', 'interviewing'];

    const { cycleId } = req.query;
    const query = {
      status: { $in: activeStatuses },
      $or: [
        { 'eligibility.campuses': { $size: 0 } },  // Open for all campuses
        { 'eligibility.campuses': { $in: campusIds } }       // Specifically includes any of managed campuses
      ]
    };

    if (cycleId) {
      query.placementCycle = cycleId;
    }

    // Get all active jobs that are eligible for this campus
    const jobs = await Job.find(query)
      .populate('eligibility.campuses', 'name')
      .select('title company jobType applicationDeadline maxPositions eligibility createdAt')
      .sort({ createdAt: -1 });

    // Get approved students count for this campus (matches the detail view criteria)
    const studentCount = await User.countDocuments({
      role: 'student',
      campus: { $in: campusIds },
      isActive: true,
      'studentProfile.profileStatus': 'approved'
    });

    // Get application counts for each job — only approved students
    const studentIds = await User.find({
      role: 'student',
      campus: { $in: campusIds },
      isActive: true,
      'studentProfile.profileStatus': 'approved'
    }).select('_id');

    const jobsWithStats = await Promise.all(jobs.map(async (job) => {
      const applications = await Application.find({
        job: job._id,
        student: { $in: studentIds.map(s => s._id) }
      }).select('status');

      return {
        _id: job._id,
        title: job.title,
        company: job.company,
        jobType: job.jobType,
        applicationDeadline: job.applicationDeadline,
        maxPositions: job.maxPositions,
        eligibleStudents: studentCount,
        applicationCount: applications.length,
        statusCounts: {
          applied: applications.filter(a => a.status === 'applied').length,
          shortlisted: applications.filter(a => a.status === 'shortlisted').length,
          in_progress: applications.filter(a => a.status === 'in_progress').length,
          selected: applications.filter(a => a.status === 'selected').length,
          rejected: applications.filter(a => a.status === 'rejected').length
        },
        createdAt: job.createdAt
      };
    }));

    res.json({
      jobs: jobsWithStats,
      totalJobs: jobs.length,
      eligibleStudents: studentCount
    });
  } catch (error) {
    console.error('Get eligible jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Company-wise application tracking for POC
/**
 * @swagger
 * /api/stats/campus-poc/company-tracking:
 *   get:
 *     summary: Track company-wise student status (POC)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company tracking data
 */
router.get('/campus-poc/company-tracking', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    const { cycleId } = req.query;

    // Get students for these campuses (optionally filtered by cycle)
    let studentQuery = {
      role: 'student',
      campus: { $in: campusIds },
      isActive: true
    };

    if (cycleId) {
      studentQuery.placementCycle = cycleId;
    }

    const students = await User.find(studentQuery).select('_id');
    const studentIds = students.map(s => s._id);

    // Get total eligible students for this campus
    const totalEligibleStudents = students.length;

    // Get all applications for these students with job details
    const applications = await Application.find({
      student: { $in: studentIds }
    })
      .populate('student', 'firstName lastName email studentProfile.currentSchool')
      .populate('job', 'title company.name company.logo jobType status interviewRounds eligibility applicationDeadline');

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
        // Calculate eligible students for this job based on campus eligibility
        const jobEligibility = app.job?.eligibility || {};
        let eligibleCount = totalEligibleStudents;

        // If job has specific campus restrictions, count accordingly
        if (jobEligibility.campuses && jobEligibility.campuses.length > 0) {
          const campusMatches = jobEligibility.campuses.some(c =>
            campusIds.includes(c.toString())
          );
          eligibleCount = campusMatches ? totalEligibleStudents : 0;
        }

        companyMap[companyName].jobs[jobTitle] = {
          jobId: app.job?._id,
          title: jobTitle,
          jobType: app.job?.jobType,
          applicationDeadline: app.job?.applicationDeadline,
          status: app.job?.status,
          eligibleCount: eligibleCount,
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
/**
 * @swagger
 * /api/stats/campus-poc/school-tracking:
 *   get:
 *     summary: Track school-wise student status (POC)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: School tracking data
 */
router.get('/campus-poc/school-tracking', auth, authorize('campus_poc', 'coordinator'), async (req, res) => {
  try {
    const campusIds = req.user.role === 'campus_poc'
      ? getPOCManagedCampusIds(req.user)
      : null;
    const { cycleId } = req.query;

    let studentQuery = {
      role: 'student',
      isActive: true
    };

    if (campusIds) {
      studentQuery.campus = { $in: campusIds };
    }

    if (cycleId) {
      studentQuery.placementCycle = cycleId;
    }

    const students = await User.find(studentQuery)
      .select('firstName lastName email studentProfile.currentSchool placementCycle')
      .populate('placementCycle', 'name');

    const studentIds = students.map(s => s._id);

    const readinessRecords = await StudentJobReadiness.find({
      student: { $in: studentIds }
    }).select('student readinessPercentage isJobReady jobReady30At jobReady100At updatedAt');

    const readinessByStudentId = new Map(
      readinessRecords.map((record) => [String(record.student), record])
    );

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
        rejected: 0,
        jobReady30Count: 0,
        jobReady100Count: 0
      };
    });

    // Populate school data
    students.forEach(student => {
      let school = student.studentProfile?.currentSchool || 'Unassigned';
      if (!schoolMap[school]) {
        schoolMap[school] = {
          school,
          students: [],
          totalStudents: 0,
          totalApplications: 0,
          placed: 0,
          inProgress: 0,
          rejected: 0,
          jobReady30Count: 0,
          jobReady100Count: 0
        };
      }
      const studentApps = applications.filter(a => a.student.toString() === student._id.toString());
      const readiness = readinessByStudentId.get(String(student._id));
      const readinessPercentage = readiness?.readinessPercentage || 0;
      const reached30 = readinessPercentage >= 30;
      const reached100 = readinessPercentage === 100 || readiness?.isJobReady;
      const jobReady30At = reached30 ? (readiness?.jobReady30At || readiness?.updatedAt || null) : null;
      const jobReady100At = reached100 ? (readiness?.jobReady100At || readiness?.updatedAt || null) : null;

      const placed = studentApps.some(a => a.status === 'selected');
      const inProgress = studentApps.some(a => ['applied', 'shortlisted', 'in_progress'].includes(a.status));

      schoolMap[school].students.push({
        studentId: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        cycle: student.placementCycle?.name,
        applicationCount: studentApps.length,
        readinessPercentage,
        reached30,
        reached100,
        jobReady30At,
        jobReady100At,
        status: placed ? 'placed' : (inProgress ? 'in_progress' : (studentApps.length > 0 ? 'rejected' : 'not_applied')),
        applications: studentApps.map(a => ({
          company: a.job?.company?.name,
          job: a.job?.title,
          status: a.status
        }))
      });

      schoolMap[school].totalStudents++;
      schoolMap[school].totalApplications += studentApps.length;
      if (reached30) schoolMap[school].jobReady30Count++;
      if (reached100) schoolMap[school].jobReady100Count++;
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
/**
 * @swagger
 * /api/stats/campus-poc/student-summary:
 *   get:
 *     summary: Summary of all students for current POC
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student summary
 */
router.get('/campus-poc/student-summary', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    const { cycleId, status, school } = req.query;

    let studentQuery = {
      role: 'student',
      campus: { $in: campusIds },
      isActive: true
    };

    if (cycleId) {
      studentQuery.placementCycle = cycleId;
    }

    if (school) {
      studentQuery['studentProfile.currentSchool'] = school;
    }

    const students = await User.find(studentQuery)
      .select('firstName lastName email studentProfile.currentSchool studentProfile.currentStatus studentProfile.externalData studentProfile.profileStatus placementCycle')
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

      // Resolve status: prioritize explicitly marked "Placed" in profile (e.g. from Ghar)
      // or if they have a selected application in this system
      const resolvedStatus = student.resolvedProfile?.currentStatus || student.studentProfile?.currentStatus;
      
      let placementStatus = 'not_applied';
      if (selectedApp || resolvedStatus === 'Placed' || resolvedStatus === 'placed') placementStatus = 'placed';
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
        applications: studentApps.map(a => ({
          applicationId: a._id,
          company: a.job?.company?.name,
          job: a.job?.title,
          jobType: a.job?.jobType,
          status: a.status,
          currentRound: a.currentRound,
          roundResults: a.roundResults,
          feedback: a.feedback,
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
/**
 * @swagger
 * /api/stats/campus-poc/cycle-stats:
 *   get:
 *     summary: Cycle-wise statistics for current POC
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cycle stats
 */
router.get('/campus-poc/cycle-stats', auth, authorize('campus_poc'), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    const PlacementCycle = require('../models/PlacementCycle');

    // Placement cycles are global (not campus-specific), so fetch all
    const cycles = await PlacementCycle.find({ isActive: true })
      .sort({ year: -1, month: -1 });

    const cycleStats = await Promise.all(cycles.map(async (cycle) => {
      // Get students from this POC's managed campuses assigned to this cycle
      const students = await User.find({
        role: 'student',
        campus: { $in: campusIds },
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

/**
 * @swagger
 * /api/stats/manager/students-readiness:
 *   get:
 *     summary: Get detailed student readiness for manager modal
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed readiness statistics
 */
router.get('/manager/students-readiness', auth, authorize('manager'), async (req, res) => {
  try {
    const students = await User.find({ role: 'student', isActive: true })
      .select('firstName lastName email campus studentProfile.currentSchool studentProfile.openForRoles')
      .populate('campus', 'name');

    const readinessRecords = await StudentJobReadiness.find();

    const result = students.map(student => {
      const readiness = readinessRecords.find(r => r.student.toString() === student._id.toString());
      return {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        campus: student.campus?.name || 'Unassigned',
        school: student.studentProfile?.currentSchool || 'Unknown',
        roles: student.studentProfile?.openForRoles || [],
        readinessPercentage: readiness?.readinessPercentage || 0,
        isJobReady: readiness?.isJobReady || false,
        approvedAt: readiness?.approvedAt || null,
        readinessStatus: readiness?.readinessStatus || 'Not Job Ready'
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching manager student readiness:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get historical cycle stats (for charts)
/**
 * @swagger
 * /api/stats/historical-cycles:
 *   get:
 *     summary: Get historical placement cycle statistics for charts
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: campus
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Historical statistics
 */
router.get('/historical-cycles', auth, authorize('manager', 'coordinator'), async (req, res) => {
  try {
    const { campus: campusId } = req.query;
    
    // Fetch all cycles sorted by date (newest first for the list, frontend reverses for charts)
    const cycles = await PlacementCycle.find({})
      .sort({ year: -1, month: -1 })
      .limit(12);

    const historicalData = cycles.map(cycle => {
      // If campus filter is applied, filter the snapshot
      let students = cycle.snapshotStudents || [];
      
      // Note: In the current schema, snapshotStudents doesn't have campus info directly.
      // We would need to populate or have it in the snapshot.
      // For now, return global stats if campusId is provided but we can't filter precisely,
      // or implement the filter if we assume all students in snapshot belong to cycles.
      
      const total = students.length;
      const placed = students.filter(s => s.status === 'placed').length;
      const released = students.filter(s => s.status === 'released').length;
      const successRate = total > 0 ? Math.round((placed / total) * 100) : 0;

      return {
        _id: cycle._id,
        name: cycle.name,
        total,
        placed,
        released,
        successRate,
        targetPlacements: cycle.targetPlacements || 0
      };
    });

    res.json({ success: true, data: historicalData });
  } catch (error) {
    console.error('Get historical cycles error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


/**
 * @swagger
 * /api/stats/talent-pipeline:
 *   get:
 *     summary: Get talent pipeline analytics (Manager/Coordinator/POC)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: campus
 *         schema:
 *           type: string
 *       - in: query
 *         name: school
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pipeline analytics data
 */
router.get('/talent-pipeline', auth, authorize('manager', 'coordinator', 'campus_poc'), async (req, res) => {
  try {
    const { campus, school } = req.query;

    // 1. Build filters
    let studentFilter = { role: 'student', isActive: true };
    if (campus) studentFilter.campus = campus;
    
    // For POC, enforce campus restriction if not manager/coordinator
    if (req.user.role === 'campus_poc') {
      const managedIds = getPOCManagedCampusIds(req.user);
      if (campus && !managedIds.includes(campus)) {
        return res.status(403).json({ message: 'Not authorized for this campus' });
      }
      if (!campus) {
        studentFilter.campus = { $in: managedIds };
      }
    }

    // 2. Fetch Students and their Readiness
    const students = await User.find(studentFilter)
      .select('firstName lastName studentProfile.openForRoles studentProfile.currentSchool campus studentProfile.currentStatus')
      .populate('campus', 'name');

    const readinessRecords = await StudentJobReadiness.find({
      student: { $in: students.map(s => s._id) }
    }).select('student isJobReady');

    const readinessMap = new Map();
    readinessRecords.forEach(r => readinessMap.set(r.student.toString(), r.isJobReady));

    // 3. Fetch Active Jobs
    // Jobs are active if they are not draft/closed/filled and deadline hasn't passed
    const activeJobs = await Job.find({ 
      status: { $nin: ['draft', 'closed', 'filled'] },
      applicationDeadline: { $gte: new Date() }
    }).select('roleCategory title status company.name');

    // 4. Fetch Active Placement Cycle for Goals
    // Prioritize cycle matching current month/year, or the most recent active one
    const now_date = new Date();
    const currentMonth = now_date.getMonth() + 1;
    const currentYear = now_date.getFullYear();

    let activeCycle = await PlacementCycle.findOne({ 
      status: 'active',
      month: currentMonth,
      year: currentYear
    });

    if (!activeCycle) {
      activeCycle = await PlacementCycle.findOne({ status: 'active' }).sort({ year: -1, month: -1 });
    }

    let totalPlaced = 0;
    
    if (activeCycle) {
      const startDate = new Date(activeCycle.year, activeCycle.month - 1, 1);
      const endDate = new Date(activeCycle.year, activeCycle.month, 0, 23, 59, 59);

      totalPlaced = await User.countDocuments({ 
        role: 'student', 
        'studentProfile.currentStatus': { $in: ['Placed', 'Intern (In Campus)', 'Intern (Out Campus)'] },
        'studentProfile.dateOfPlacement': { $gte: startDate, $lte: endDate }
      });
    }

    // 5. Aggregate Data by Role
    const pipeline = {};

    const initRole = (role) => {
      if (!pipeline[role]) {
        pipeline[role] = {
          role,
          totalInterested: 0,
          jobReady: 0,
          activeJobs: 0,
          readyStudents: [], // Top 5 students for quick view
          openJobList: [] // Top 3 jobs for quick view
        };
      }
    };

    // Process Student Interests
    students.forEach(student => {
      const roles = student.studentProfile?.openForRoles || [];
      const isReady = readinessMap.get(student._id.toString()) || false;
      const studentSchool = student.studentProfile?.currentSchool;
      const studentStatus = student.studentProfile?.currentStatus || 'Active';

      // Filter by school if provided
      if (school && studentSchool !== school) return;
      
      // Only include Active/Intern statuses as per user's earlier requirement for readiness dashboards
      const allowedStatuses = ['Active', 'Intern (In Campus)', 'Intern (Out Campus)'];
      if (!allowedStatuses.includes(studentStatus)) return;

      roles.forEach(role => {
        if (!role) return;
        initRole(role);
        pipeline[role].totalInterested++;
        if (isReady) {
          pipeline[role].jobReady++;
          if (pipeline[role].readyStudents.length < 5) {
            pipeline[role].readyStudents.push({
              _id: student._id,
              name: `${student.firstName} ${student.lastName}`,
              campus: student.campus?.name
            });
          }
        }
      });
    });

    // Process Jobs
    activeJobs.forEach(job => {
      const role = job.roleCategory || 'Other';
      initRole(role);
      pipeline[role].activeJobs++;
      if (pipeline[role].openJobList.length < 3) {
        pipeline[role].openJobList.push({
          _id: job._id,
          title: job.title,
          company: job.company.name
        });
      }
    });

    // Convert to array and sort by interest
    const rolesData = Object.values(pipeline).sort((a, b) => b.totalInterested - a.totalInterested);

    res.json({
      roles: rolesData,
      cycle: activeCycle ? {
        name: activeCycle.name,
        target: activeCycle.targetPlacements,
        current: totalPlaced,
        id: activeCycle._id
      } : null
    });
  } catch (error) {
    console.error('Talent pipeline stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

