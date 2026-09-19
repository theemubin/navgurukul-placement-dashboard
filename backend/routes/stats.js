const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const InterestRequest = require('../models/InterestRequest');
const Campus = require('../models/Campus');
const PlacementCycle = require('../models/PlacementCycle');
const { StudentJobReadiness } = require('../models/JobReadiness');
const { auth, authorize } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');
const cacheService = require('../services/redisCacheService');
const fs = require('fs');

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
router.get('/reports', auth, authorize('manager'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
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

    // 1b. Jobs by Type (full_time, part_time, internship, contract, paid_project)
    const jobsByTypeRaw = await Job.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$jobType', 'full_time'] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const jobTypeLabels = {
      full_time: 'Full Time',
      part_time: 'Part Time',
      internship: 'Internship',
      contract: 'Contract',
      paid_project: 'Paid Project'
    };

    const jobsByType = jobsByTypeRaw.map(item => ({
      type: item._id,
      label: jobTypeLabels[item._id] || item._id,
      count: item.count,
      percentage: totalJobs > 0 ? Math.round((item.count / totalJobs) * 100) : 0
    }));

    // 1c. Jobs by Role Category
    const jobsByCategoryRaw = await Job.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$roleCategory', 'Uncategorized'] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);

    const jobsByCategory = jobsByCategoryRaw.map(item => ({
      category: item._id || 'Uncategorized',
      count: item.count,
      percentage: totalJobs > 0 ? Math.round((item.count / totalJobs) * 100) : 0
    }));

    // 2. Monthly Placement Trend (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const monthlyDataRaw = await Application.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
          status: { $ne: 'interested' }
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
      jobsByType,
      jobsByCategory,
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
router.get('/dashboard', auth, authorize('coordinator', 'manager'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
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
    let applicationQuery = { status: { $ne: 'interested' } };
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

    // Students by school (per campus) - shows where students are present
    const studentsBySchool = await User.aggregate([
      { $match: studentQuery },
      { $group: { _id: { campus: '$campus', school: '$studentProfile.currentSchool' }, count: { $sum: 1 } } },
      { $lookup: { from: 'campuses', localField: '_id.campus', foreignField: '_id', as: 'campusData' } },
      { $unwind: { path: '$campusData', preserveNullAndEmptyArrays: true } },
      { $project: { campusId: '$_id.campus', campusName: '$campusData.name', school: '$_id.school', count: 1, _id: 0 } }
    ]);

    // Placements by school (per campus)
    const placementsBySchool = await Application.aggregate([
      { $match: { ...applicationQuery, status: 'selected' } },
      { $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: 'studentData' } },
      { $unwind: '$studentData' },
      { $group: { _id: { campus: '$studentData.campus', school: '$studentData.studentProfile.currentSchool' }, count: { $sum: 1 } } },
      { $lookup: { from: 'campuses', localField: '_id.campus', foreignField: '_id', as: 'campusData' } },
      { $unwind: { path: '$campusData', preserveNullAndEmptyArrays: true } },
      { $project: { campusId: '$_id.campus', campusName: '$campusData.name', school: '$_id.school', count: 1, _id: 0 } }
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
      studentsBySchool,
      placementsBySchool,
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
router.get('/campus', auth, authorize('coordinator', 'manager'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
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
  const studentId = req.userId;
  const cacheKey = `student:stats:${studentId}`;

  try {
    const responseData = await cacheService.getOrCompute(
      cacheKey,
      async () => {
        const applications = await Application.find({ student: studentId })
          .populate('job', 'title company.name status');

        const stats = {
          totalApplications: applications.length,
          inProgress: applications.filter(a => ['applied', 'shortlisted', 'in_progress', 'interviewing'].includes(a.status)).length,
          selected: applications.filter(a => a.status === 'selected').length,
          rejected: applications.filter(a => a.status === 'rejected').length,
          interested: applications.filter(a => a.status === 'interested').length
        };

        const recentApplications = applications
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 5);

        return { stats, recentApplications };
      },
      60
    );

    res.json(responseData);
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
router.get('/coordinator-stats', auth, authorize('manager'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
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

      const applicationFilter = { job: { $in: jobIds }, status: { $ne: 'interested' } };
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
router.get('/campus-poc', auth, authorize('campus_poc'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    const { status: filterStatus } = req.query; // Filter by Active/Placed etc

    let studentQuery = {
      role: 'student',
      campus: { $in: campusIds },
      isActive: true
    };

    if (filterStatus && filterStatus !== 'all') {
      studentQuery['studentProfile.currentStatus'] = filterStatus;
    }

    const students = await User.find(studentQuery)
      .select('studentProfile.skills.status studentProfile.profileStatus studentProfile.currentStatus')
      .lean();

    const studentIds = students.map(s => s._id);

    if (studentIds.length === 0) {
      return res.json({
        totalStudents: 0,
        pendingSkillApprovals: 0,
        pendingProfileApprovals: 0,
        totalApplications: 0,
        totalPlacements: 0,
        placementRate: 0,
        statusCounts: {
          'Active': 0,
          'In active': 0,
          'Long Leave': 0,
          'Dropout': 0,
          'Placed': 0
        },
        readinessPool: {
          'Job Ready': 0,
          'Job Ready Under Process': 0,
          'Not Job Ready': 0
        },
        interestCount: 0
      });
    }

    // Pending skill approvals
    const pendingSkills = students.reduce((count, student) => {
      return count + (student.studentProfile?.skills?.filter(s => s.status === 'pending').length || 0);
    }, 0);

    // Pending profile approvals
    const pendingProfiles = students.filter(s =>
      s.studentProfile?.profileStatus === 'pending_approval'
    ).length;

    const [totalApplications, placements, readinessRecords, openJobIds] = await Promise.all([
      Application.countDocuments({ student: { $in: studentIds } }),
      Application.countDocuments({ student: { $in: studentIds }, status: 'selected' }),
      StudentJobReadiness.aggregate([
        { $match: { student: { $in: studentIds } } },
        {
          $group: {
            _id: '$readinessStatus',
            count: { $sum: 1 }
          }
        }
      ]),
      Job.distinct('_id', { status: { $in: ['active', 'application_stage'] } })
    ]);

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

    const readinessPool = {
      'Job Ready': 0,
      'Job Ready Under Process': 0,
      'Not Job Ready': 0
    };

    readinessRecords.forEach(record => {
      const status = record._id || 'Not Job Ready';
      if (readinessPool[status] !== undefined) {
        readinessPool[status] = record.count;
      }
    });

    // Interest count (only for jobs that are currently open)
    const interestCount = await InterestRequest.countDocuments({
      student: { $in: studentIds },
      status: 'pending',
      job: { $in: openJobIds }
    });

    res.json({
      totalStudents: students.length,
      pendingSkillApprovals: pendingSkills,
      pendingProfileApprovals: pendingProfiles,
      totalApplications,
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
      'studentProfile.profileStatus': 'approved',
      'studentProfile.currentStatus': { $in: ['Active', 'Intern (In Campus)', 'Intern (Out Campus)'] }
    })
      .populate('studentProfile.skills.skill', 'name')
      .select('firstName lastName email studentProfile.currentSchool studentProfile.enrollmentNumber studentProfile.skills studentProfile.academicRecords');

    // Check if each student has already applied (including placed/inactive students)
    const allCampusStudents = await User.find({
      role: 'student',
      campus: { $in: campusIds }
    }).select('_id');
    const allCampusStudentIds = allCampusStudents.map(s => s._id);

    const applicationMap = {};
    const applications = await Application.find({
      job: jobId,
      student: { $in: allCampusStudentIds }
    }).select('student status');

    applications.forEach(app => {
      applicationMap[app.student.toString()] = app.status;
    });

    // Build student list with match info (only active/eligible students are returned in list)
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
      applied: applications.length,
      notApplied: eligibleStudents.filter(s => !s.hasApplied).length
    });
  } catch (error) {
    console.error('Get eligible students for job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Notify eligible students about a job
router.post('/campus-poc/job/:jobId/notify-eligible', auth, authorize('campus_poc', 'coordinator', 'manager'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const campusIds = getPOCManagedCampusIds(req.user);

    // 1. Get the job
    const job = await Job.findById(jobId).populate('requiredSkills.skill', 'name category');
    if (!job) return res.status(404).json({ message: 'Job not found' });

    // 2. Get students for this campus (reuse eligibility logic)
    const students = await User.find({
      role: 'student',
      campus: { $in: campusIds },
      isActive: true,
      'studentProfile.profileStatus': 'approved',
      'studentProfile.currentStatus': { $in: ['Active', 'Intern (In Campus)', 'Intern (Out Campus)'] }
    }).populate('studentProfile.skills.skill', 'name');

    // Filter only eligible students (simplified for logic reuse)
    const eligibleStudents = students.filter(student => {
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
      return totalRequired > 0 ? (matchedSkills / totalRequired) >= 0.5 : true; // 50% match threshold
    });

    if (eligibleStudents.length === 0) {
      return res.status(400).json({ message: 'No eligible students found to notify' });
    }

    // 3. Get first managed campus to find Discord channel (or use user's primary campus)
    const primaryCampusId = campusIds[0];
    const campus = await Campus.findById(primaryCampusId);

    if (!campus || !campus.discordChannelId) {
      return res.status(400).json({ message: 'No Discord channel configured for your campus' });
    }

    // 3.5 Check for existing thread for this campus
    const existingThread = (job.discordThreads || []).find(t => t.campus.toString() === primaryCampusId.toString());

    // 4. Trigger Discord Notification
    const discordService = require('../services/discordService');
    const discordResult = await discordService.sendEligibleStudentsNotification(
      job,
      eligibleStudents,
      campus,
      req.user,
      existingThread?.threadId
    );

    // 4.5 Save thread info if new
    if (discordResult?.threadId && (!existingThread || existingThread.threadId !== discordResult.threadId)) {
      if (!job.discordThreads) job.discordThreads = [];

      const threadIndex = job.discordThreads.findIndex(t => t.campus.toString() === primaryCampusId.toString());
      if (threadIndex > -1) {
        job.discordThreads[threadIndex].threadId = discordResult.threadId;
      } else {
        job.discordThreads.push({
          campus: primaryCampusId,
          threadId: discordResult.threadId,
          channelId: campus.discordChannelId
        });
      }
      await job.save();
    }

    // 5. Create Internal Notifications
    const Notification = require('../models/Notification');
    const notificationPromises = eligibleStudents.map(async (student) => {
      // Check if student already applied
      const alreadyApplied = await Application.exists({ job: jobId, student: student._id });
      if (alreadyApplied) return null;

      return Notification.create({
        recipient: student._id,
        type: 'new_job_posting',
        title: `Opportunity: ${job.title}`,
        message: `PoC ${req.user.firstName} has identified you as eligible for the ${job.title} role at ${job.company.name}. Apply now!`,
        link: `/student/jobs/${job._id}`,
        relatedEntity: { type: 'job', id: job._id }
      });
    });

    await Promise.all(notificationPromises);

    res.json({
      success: true,
      message: `Notifications sent to ${eligibleStudents.length} students via Discord and system.`,
      discordResult
    });

  } catch (error) {
    console.error('Notify eligible students error:', error);
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
router.get('/campus-poc/eligible-jobs', auth, authorize('campus_poc'), cacheMiddleware({ type: 'jobs', keyPrefix: 'stats' }), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    // Support both legacy 'active' and pipeline stages
    const activeStatuses = ['active', 'application_stage', 'hr_shortlisting', 'interviewing', 'closed'];

    const { cycleId, summary } = req.query;
    const liteSummary = summary === 'lite';
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

    // Get all active/closed jobs that are eligible for this campus
    const jobs = await Job.find(query)
      .populate('eligibility.campuses', 'name')
      .select('title company jobType applicationDeadline maxPositions eligibility createdAt status')
      .sort({ createdAt: -1 });

    // Get approved students count for this campus (matches the detail view criteria)
    const studentCount = await User.countDocuments({
      role: 'student',
      campus: { $in: campusIds },
      isActive: true,
      'studentProfile.profileStatus': 'approved',
      'studentProfile.currentStatus': { $in: ['Active', 'Intern (In Campus)', 'Intern (Out Campus)'] }
    });

    // Get application counts for all jobs in one query (including placed/inactive students)
    const allCampusStudents = await User.find({
      role: 'student',
      campus: { $in: campusIds }
    }).select('_id');
    const studentIds = allCampusStudents.map(student => student._id);
    const jobIds = jobs.map(job => job._id);
    const applications = await Application.find({
      job: { $in: jobIds },
      student: { $in: studentIds }
    }).select('job status').lean();
    const applicationsByJob = new Map();

    applications.forEach((application) => {
      const jobId = String(application.job);
      const jobApplications = applicationsByJob.get(jobId) || [];
      jobApplications.push(application);
      applicationsByJob.set(jobId, jobApplications);
    });

    const jobsWithStats = jobs.map((job) => {
      const jobApplications = applicationsByJob.get(String(job._id)) || [];

      return {
        _id: job._id,
        title: job.title,
        company: job.company,
        jobType: job.jobType,
        applicationDeadline: job.applicationDeadline,
        maxPositions: job.maxPositions,
        eligibleStudents: studentCount,
        applicationCount: jobApplications.length,
        statusCounts: {
          applied: jobApplications.filter(a => a.status === 'applied').length,
          shortlisted: jobApplications.filter(a => a.status === 'shortlisted').length,
          in_progress: jobApplications.filter(a => a.status === 'in_progress').length,
          selected: jobApplications.filter(a => a.status === 'selected').length,
          rejected: jobApplications.filter(a => a.status === 'rejected').length
        },
        status: job.status,
        createdAt: job.createdAt
      };
    });

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
router.get('/campus-poc/company-tracking', auth, authorize('campus_poc'), cacheMiddleware({ type: 'applications', keyPrefix: 'stats' }), async (req, res) => {
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
router.get('/campus-poc/school-tracking', auth, authorize('campus_poc', 'coordinator'), cacheMiddleware({ type: 'campus', keyPrefix: 'stats' }), async (req, res) => {
  try {
    const campusIds = req.user.role === 'campus_poc'
      ? getPOCManagedCampusIds(req.user)
      : null;
    const { cycleId, summary } = req.query;
    const liteSummary = summary === 'lite';

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
      .populate('placementCycle', 'name')
      .lean();

    const studentIds = students.map(s => s._id);

    const readinessRecords = await StudentJobReadiness.find({
      student: { $in: studentIds }
    }).select('student readinessPercentage isJobReady jobReady30At jobReady100At updatedAt').lean();

    const readinessByStudentId = new Map(
      readinessRecords.map((record) => [String(record.student), record])
    );

    // Get all applications
    const applications = await Application.find({
      student: { $in: studentIds }
    }).select('student job status').populate('job', 'title company.name').lean();
    const applicationsByStudentId = new Map();
    applications.forEach((application) => {
      const studentId = String(application.student);
      const studentApplications = applicationsByStudentId.get(studentId) || [];
      studentApplications.push(application);
      applicationsByStudentId.set(studentId, studentApplications);
    });

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
      const studentApps = applicationsByStudentId.get(String(student._id)) || [];
      const readiness = readinessByStudentId.get(String(student._id));
      const readinessPercentage = readiness?.readinessPercentage || 0;
      const reached30 = readinessPercentage >= 30;
      const reached100 = readinessPercentage === 100 || readiness?.isJobReady;
      const jobReady30At = reached30 ? (readiness?.jobReady30At || readiness?.updatedAt || null) : null;
      const jobReady100At = reached100 ? (readiness?.jobReady100At || readiness?.updatedAt || null) : null;

      const placed = studentApps.some(a => a.status === 'selected');
      const inProgress = studentApps.some(a => ['applied', 'shortlisted', 'in_progress'].includes(a.status));

      const studentSummary = {
        studentId: student._id,
        name: `${student.firstName} ${student.lastName}`,
        cycle: student.placementCycle?.name,
        applicationCount: studentApps.length,
        readinessPercentage,
        reached30,
        reached100,
        jobReady30At,
        jobReady100At,
        status: placed ? 'placed' : (inProgress ? 'in_progress' : (studentApps.length > 0 ? 'rejected' : 'not_applied'))
      };

      if (!liteSummary) {
        studentSummary.applications = studentApps.map(a => ({
          company: a.job?.company?.name,
          job: a.job?.title,
          status: a.status
        }));
      }

      schoolMap[school].students.push(studentSummary);

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
router.get('/campus-poc/student-summary', auth, authorize('campus_poc'), cacheMiddleware({ type: 'student', keyPrefix: 'stats' }), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    const { cycleId, status, school, search } = req.query;

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

    if (search) {
      const escapedSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (escapedSearch) {
        studentQuery.$or = [
          { firstName: { $regex: escapedSearch, $options: 'i' } },
          { lastName: { $regex: escapedSearch, $options: 'i' } },
          { email: { $regex: escapedSearch, $options: 'i' } },
          { 'studentProfile.currentSchool': { $regex: escapedSearch, $options: 'i' } }
        ];
      }
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
    const applicationsByStudentId = new Map();
    applications.forEach((application) => {
      const studentId = String(application.student);
      const studentApplications = applicationsByStudentId.get(studentId) || [];
      studentApplications.push(application);
      applicationsByStudentId.set(studentId, studentApplications);
    });

    // Build summary for each student
    const studentSummaries = students.map(student => {
      const studentApps = applicationsByStudentId.get(String(student._id)) || [];
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

    const totalStudentsCount = filteredSummaries.length;
    
    // Pagination
    let paginatedStudents = filteredSummaries;
    let page = null;
    let limit = null;
    let totalPages = null;

    if (req.query.page || req.query.limit) {
      page = parseInt(req.query.page, 10) || 1;
      limit = parseInt(req.query.limit, 10) || 15;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      paginatedStudents = filteredSummaries.slice(startIndex, endIndex);
      totalPages = Math.ceil(totalStudentsCount / limit);
    }

    res.json({
      summary: {
        total: studentSummaries.length,
        placed: studentSummaries.filter(s => s.placementStatus === 'placed').length,
        inProgress: studentSummaries.filter(s => s.placementStatus === 'in_progress').length,
        notApplied: studentSummaries.filter(s => s.placementStatus === 'not_applied').length,
        rejected: studentSummaries.filter(s => s.placementStatus === 'rejected').length
      },
      students: paginatedStudents,
      pagination: page ? {
        totalStudents: totalStudentsCount,
        page,
        limit,
        totalPages
      } : undefined
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
router.get('/campus-poc/cycle-stats', auth, authorize('campus_poc'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
  try {
    const campusIds = getPOCManagedCampusIds(req.user);
    const PlacementCycle = require('../models/PlacementCycle');

    // Placement cycles are global (not campus-specific), so fetch all
    const cycles = await PlacementCycle.find({ isActive: true })
      .sort({ year: -1, month: -1 });

    const students = await User.find({
      role: 'student',
      campus: { $in: campusIds },
      placementCycle: { $in: cycles.map(cycle => cycle._id) }
    }).select('_id placementCycle');
    const studentIds = students.map(student => student._id);
    const applications = await Application.find({
      student: { $in: studentIds }
    }).select('student status').lean();
    const studentsByCycle = new Map();
    const applicationsByStudentId = new Map();

    students.forEach((student) => {
      const cycleId = String(student.placementCycle);
      const cycleStudents = studentsByCycle.get(cycleId) || [];
      cycleStudents.push(student);
      studentsByCycle.set(cycleId, cycleStudents);
    });
    applications.forEach((application) => {
      const studentApplications = applicationsByStudentId.get(String(application.student)) || [];
      studentApplications.push(application);
      applicationsByStudentId.set(String(application.student), studentApplications);
    });

    const cycleStats = cycles.map((cycle) => {
      const cycleStudents = studentsByCycle.get(String(cycle._id)) || [];
      const cycleApplications = cycleStudents.flatMap(student =>
        applicationsByStudentId.get(String(student._id)) || []
      );
      const placed = cycleApplications.filter(a => a.status === 'selected').length;
      const inProgress = cycleApplications.filter(a => ['applied', 'shortlisted', 'in_progress'].includes(a.status)).length;

      return {
        cycleId: cycle._id,
        name: cycle.name,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
        targetPlacements: cycle.targetPlacements,
        students: cycleStudents.length,
        applications: cycleApplications.length,
        placed,
        inProgress,
        progress: cycle.targetPlacements > 0
              ? Math.round((placed / cycle.targetPlacements) * 100)
              : (cycleStudents.length > 0 ? Math.round((placed / cycleStudents.length) * 100) : 0)
      };
            });

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
router.get('/manager/students-readiness', auth, authorize('manager'), cacheMiddleware({ type: 'job_readiness', keyPrefix: 'stats' }), async (req, res) => {
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
router.get('/historical-cycles', auth, authorize('manager', 'coordinator'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
  try {
    const { campus: campusId } = req.query;

    // Build filter for placed students from Ghar data
    let studentFilter = {
      role: 'student',
      'studentProfile.currentStatus': { $regex: /placed/i }, // Status contains "placed"
      'studentProfile.dateOfPlacement': { $exists: true, $ne: null } // Has placement date from Ghar
    };

    if (campusId) {
      studentFilter.campus = campusId;
    }

    // Fetch all placed students with their placement dates
    const placedStudents = await User.find(studentFilter)
      .select('studentProfile.dateOfPlacement placementCycle')
      .lean();

    // Group placements by month/year
    const placementsByMonth = {};
    placedStudents.forEach(student => {
      const placementDate = new Date(student.studentProfile.dateOfPlacement);
      const year = placementDate.getFullYear();
      const month = placementDate.getMonth() + 1; // 1-12
      const key = `${year}-${String(month).padStart(2, '0')}`;
      
      if (!placementsByMonth[key]) {
        placementsByMonth[key] = {
          year,
          month,
          placed: 0
        };
      }
      placementsByMonth[key].placed++;
    });

    // Fetch placement cycles to get maxStudentsInCycle and names
    const cycles = await PlacementCycle.find({})
      .sort({ year: -1, month: -1 })
      .limit(12)
      .lean();

    // Merge cycle data with placement counts
    const historicalData = cycles.map(cycle => {
      const key = `${cycle.year}-${String(cycle.month).padStart(2, '0')}`;
      const placementData = placementsByMonth[key] || { placed: 0 };

      // Use maxStudentsInCycle for historical reporting (captures peak enrollment)
      const totalInCycle = cycle.maxStudentsInCycle || 0;
      const placed = placementData.placed;
      const successRate = totalInCycle > 0 ? Math.round((placed / totalInCycle) * 100) : 0;

      return {
        _id: cycle._id,
        name: cycle.name,
        totalInCycle,  // Maximum students ever in this cycle
        placed,        // Actual placements from Ghar data (by dateOfPlacement)
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
 * /api/stats/campus-placement-trends:
 *   get:
 *     summary: Get campus-wise placement trends over months (line chart data)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campus placement trends by month
 */
router.get('/campus-placement-trends', auth, authorize('manager', 'coordinator'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
  try {
    // Fetch all placed students with campus and placement date
    const placedStudents = await User.find({
      role: 'student',
      'studentProfile.currentStatus': { $regex: /placed/i },
      'studentProfile.dateOfPlacement': { $exists: true, $ne: null }
    })
      .select('campus studentProfile.dateOfPlacement')
      .populate('campus', 'name')
      .lean();

    // Group by month/year and campus
    const trendData = {};
    const campusNames = new Set();

    placedStudents.forEach(student => {
      const campusName = student.campus?.name || 'Unknown Campus';
      campusNames.add(campusName);

      const placementDate = new Date(student.studentProfile.dateOfPlacement);
      const year = placementDate.getFullYear();
      const month = placementDate.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      if (!trendData[monthKey]) {
        trendData[monthKey] = {
          month: monthKey,
          year,
          monthNum: month,
          campuses: {}
        };
      }

      if (!trendData[monthKey].campuses[campusName]) {
        trendData[monthKey].campuses[campusName] = 0;
      }
      trendData[monthKey].campuses[campusName]++;
    });

    // Convert to array and format for line chart
    const months = Object.keys(trendData).sort();
    const chartData = months.map(monthKey => {
      const data = trendData[monthKey];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedMonth = `${monthNames[data.monthNum - 1]} ${data.year}`;
      
      const point = {
        month: formattedMonth,
        monthKey: monthKey
      };

      // Add each campus as a separate data point
      Array.from(campusNames).forEach(campus => {
        point[campus] = data.campuses[campus] || 0;
      });

      return point;
    });

    res.json({
      success: true,
      data: {
        chartData: chartData.slice(-12), // Last 12 months
        campuses: Array.from(campusNames)
      }
    });
  } catch (error) {
    console.error('Get campus placement trends error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/stats/long-term-students-trend:
 *   get:
 *     summary: Get long-term students (>12 months, not placed) trend by campus
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Long-term students trend data
 */
router.get('/long-term-students-trend', auth, authorize('manager', 'coordinator'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
  try {
    const now = new Date();
    const monthsToShow = 12;
    
    // Generate last 12 months
    const months = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      months.push({ year, month, monthKey: `${year}-${String(month).padStart(2, '0')}` });
    }
    
    const campusNames = new Set();
    const trendData = {};
    
    // For each month, calculate students with >12 months tenure who weren't placed yet
    for (const { year, month, monthKey } of months) {
      // Reference date: end of that month
      const referenceDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month
      
      // 12 months before reference date
      const twelveMonthsPrior = new Date(referenceDate);
      twelveMonthsPrior.setFullYear(twelveMonthsPrior.getFullYear() - 1);
      
      // Find students who joined 12+ months before the reference date (using Ghar joiningDate)
      // Behavior:
      // - For the most recent month we only count students whose current status is exactly 'Active'.
      // - For historical months we include all students joined before cutoff but exclude known non-actionable statuses
      //   (dropouts, interns, inactive, opted-out, long leave) and those already placed as of reference date.
      const isLatestMonth = monthKey === months[months.length - 1].monthKey;

      const excludedStatuses = [
        'Dropout', 'DropOut', 'InActive', 'Completed-Opted out for placement', 'Long Leave', 'Intern'
      ];

      const baseQuery = {
        role: 'student',
        'studentProfile.joiningDate': { $exists: true, $lte: twelveMonthsPrior },
        $or: [
          { 'studentProfile.dateOfPlacement': { $exists: false } },
          { 'studentProfile.dateOfPlacement': null },
          { 'studentProfile.dateOfPlacement': { $gt: referenceDate } }
        ]
      };

      if (isLatestMonth) {
        // Only Active students for current/latest month
        baseQuery['studentProfile.currentStatus'] = 'Active';
      } else {
        // Historical months: include all but explicitly remove non-actionable statuses
        baseQuery['studentProfile.currentStatus'] = { $nin: excludedStatuses };
      }

      const longTermStudents = await User.find(baseQuery)
        .select('campus studentProfile.joiningDate studentProfile.currentStatus studentProfile.dateOfPlacement')
        .populate('campus', 'name')
        .lean();
      
      console.log(`[LongTerm] Month ${monthKey}: Found ${longTermStudents.length} students with >12mo tenure from Ghar joiningDate (cutoff: ${twelveMonthsPrior.toISOString()})`);
      
      // Group by campus
      const campusCounts = {};
      longTermStudents.forEach(student => {
        const campusName = student.campus?.name || 'Unknown Campus';
        campusNames.add(campusName);
        campusCounts[campusName] = (campusCounts[campusName] || 0) + 1;
      });
      
      trendData[monthKey] = {
        month: monthKey,
        year,
        monthNum: month,
        campuses: campusCounts
      };
    }
    
    // Convert to chart format
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = months.map(({ monthKey }) => {
      const data = trendData[monthKey];
      const formattedMonth = `${monthNames[data.monthNum - 1]} ${data.year}`;
      
      const point = {
        month: formattedMonth,
        monthKey: monthKey
      };
      
      // Add each campus count
      Array.from(campusNames).forEach(campus => {
        point[campus] = data.campuses[campus] || 0;
      });
      
      return point;
    });
    
    res.json({
      success: true,
      data: {
        chartData,
        campuses: Array.from(campusNames),
        description: 'Students with >12 months tenure who are not yet placed'
      }
    });
  } catch (error) {
    console.error('Get long-term students trend error:', error);
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
router.get('/talent-pipeline', auth, authorize('manager', 'coordinator', 'campus_poc'), cacheMiddleware({ type: 'dashboard', keyPrefix: 'stats' }), async (req, res) => {
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
      .select('firstName lastName studentProfile.openForRoles studentProfile.currentSchool campus studentProfile.currentStatus studentProfile.joiningDate studentProfile.dateOfPlacement placementCycle studentProfile.englishProficiency studentProfile.externalData.ghar.englishSpeaking')
      .populate('campus', 'name');

    const readinessRecords = await StudentJobReadiness.find({
      student: { $in: students.map(s => s._id) }
    }).select('student isJobReady');

    const readinessMap = new Map();
    readinessRecords.forEach(r => readinessMap.set(r.student.toString(), r.isJobReady));

    // 3. Fetch Active Jobs
    // Jobs are considered active until they are marked closed or filled
    const activeJobs = await Job.find({
      status: { $nin: ['draft', 'closed', 'filled'] }
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

    // Financial Year: April 1 → March 31
    // Current date: 2026-09-04 → FY is April 1 2026 → March 31 2027
    const now_fy = new Date();
    const fyStartYear = now_fy.getMonth() >= 3 ? now_fy.getFullYear() : now_fy.getFullYear() - 1;
    const fyStart = new Date(fyStartYear, 3, 1, 0, 0, 0); // April 1
    const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59); // March 31

    // Count placements for the current calendar month using Ghar-synced placement date.
    const monthStart = new Date(now_date.getFullYear(), now_date.getMonth(), 1);
    const monthEnd = new Date(now_date.getFullYear(), now_date.getMonth() + 1, 0, 23, 59, 59);

    totalPlaced = await User.countDocuments({
      role: 'student',
      'studentProfile.currentStatus': { $in: ['Placed', 'Intern (In Campus)', 'Intern (Out Campus)'] },
      'studentProfile.dateOfPlacement': { $gte: monthStart, $lte: monthEnd }
    });

    // Fetch all campuses to get their placement targets
    const allCampusDocs = await Campus.find({ isActive: true }).select('_id placementTarget');

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

    // Allowed statuses for pipeline
    const allowedStatuses = ['Active', 'Intern (In Campus)', 'Intern (Out Campus)'];

    // 5b. Campus Breakdown — aggregate per-campus stats
    const campusMap = {};
    // Helper to parse communication level (B2+)
    const isCommReady = (student) => {
      const gharSpeak = student.studentProfile?.externalData?.ghar?.englishSpeaking?.value;
      const gharWrite = student.studentProfile?.externalData?.ghar?.englishWriting?.value;
      const localSpeak = student.studentProfile?.englishProficiency?.speaking;
      const localWrite = student.studentProfile?.englishProficiency?.writing;
      const speak = (gharSpeak || localSpeak || '').toUpperCase();
      const write = (gharWrite || localWrite || '').toUpperCase();
      const good = ['B2', 'C1', 'C2'];
      return good.includes(speak) && good.includes(write);
    };

    // Process Student Interests
    students.forEach(student => {
      const roles = student.studentProfile?.openForRoles || [];
      const isReady = readinessMap.get(student._id.toString()) || false;
      const studentSchool = student.studentProfile?.currentSchool;
      // Prefer Ghar/resolved status where available
      const studentStatus = (student.resolvedProfile && student.resolvedProfile.currentStatus)
        || student.studentProfile?.currentStatus
        || 'Active';

      // Filter by school if provided
      if (school && studentSchool !== school) return;

      // --- Campus breakdown accumulation ---
      const campusId = student.campus?._id?.toString() || 'unknown';
      const campusName = student.campus?.name || 'Unknown Campus';
      if (!campusMap[campusId]) {
        campusMap[campusId] = {
          campusId,
          campusName,
          totalStudents: 0,
          activeCount: 0,
          internsInCampus: 0,
          internsOutCampus: 0,
          openForPlacements: 0, // Active + interns
          placedCount: 0, // from Ghar/resolved status
          fyPlaced: 0, // Students with "Placed" status who had dateOfPlacement in current FY
          fyIntern: 0, // Students with intern status who joined/placed in current FY
          placementReady: 0,
          readinessPending: 0,
          cycleNotAllocated: 0,
          communicationReady: 0
        };
      }

      // We'll derive totalStudents from the status buckets (Active + Interns)

      // Count status buckets (normalize to lowercase to handle variations)
      const statusKey = (studentStatus || '').trim();
      const statusKeyNorm = statusKey.toLowerCase();
      if (statusKeyNorm === 'active') campusMap[campusId].activeCount++;
      if (statusKeyNorm === 'intern (in campus)') campusMap[campusId].internsInCampus++;
      if (statusKeyNorm === 'intern (out campus)') campusMap[campusId].internsOutCampus++;

      // Open for placements: Active + both Intern statuses
      if (['active', 'intern (in campus)', 'intern (out campus)'].includes(statusKeyNorm)) {
        campusMap[campusId].openForPlacements++;
      }

      // Placed This Cycle: Count only if placed in current month (Ghar-synced dateOfPlacement)
      if (statusKeyNorm.includes('placed')) {
        const placementDate = student.studentProfile?.dateOfPlacement;
        if (placementDate) {
          const pDate = new Date(placementDate);
          if (pDate >= monthStart && pDate <= monthEnd) {
            campusMap[campusId].placedCount++;
          }
          // FY Placed: Student has "Placed" status with dateOfPlacement in current financial year
          if (pDate >= fyStart && pDate <= fyEnd) {
            campusMap[campusId].fyPlaced++;
          }
        }
      }

      // FY Intern: Students who became Intern (In/Out Campus) with dateOfPlacement in current FY
      if (statusKeyNorm === 'intern (in campus)' || statusKeyNorm === 'intern (out campus)') {
        const placementDate = student.studentProfile?.dateOfPlacement;
        if (placementDate) {
          const pDate = new Date(placementDate);
          if (pDate >= fyStart && pDate <= fyEnd) {
            campusMap[campusId].fyIntern++;
          }
        }
      }

      // Placement readiness
      if (isReady) campusMap[campusId].placementReady++;

      // Placement readiness pending: Active (not interns) AND NOT job-ready
      if (statusKeyNorm === 'active' && !isReady) {
        campusMap[campusId].readinessPending++;
      }

      // Cycle Not Allocated: student has Active/Intern status, joined > 12 months ago and not in a cycle
      const hasCycle = !!student.placementCycle;
      if (!hasCycle) {
        // check joining date > 12 months
        const joining = student.studentProfile?.joiningDate ? new Date(student.studentProfile.joiningDate) : null;
        if (joining) {
          const months = (new Date().getFullYear() - joining.getFullYear()) * 12 + (new Date().getMonth() - joining.getMonth());
          if (months >= 12 && ['active', 'intern (in campus)', 'intern (out campus)'].includes(statusKeyNorm)) {
            campusMap[campusId].cycleNotAllocated++;
          }
        }
      }

      // Communication Ready: both speaking and writing B2+
      if (isCommReady(student)) {
        campusMap[campusId].communicationReady++;
      }

      // --- Role pipeline accumulation (existing logic) ---
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
      const trimmedCategory = (job.roleCategory || '').trim();
      const role = trimmedCategory || 'Other';
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

    // Build campus -> schools breakdown from fetched students with detailed metrics
    const campusSchoolsMap = {};
    const studentIds = students.map(s => s._id);
    students.forEach(student => {
      const campusId = student.campus?._id?.toString() || 'unknown';
      const campusName = student.campus?.name || 'Unknown Campus';
      const school = student.studentProfile?.currentSchool || 'Unknown School';
      const isReady = readinessMap.get(student._id.toString()) || false;

      // Determine resolved/current status for placement buckets
      const studentStatus = (student.resolvedProfile && student.resolvedProfile.currentStatus)
        || student.studentProfile?.currentStatus
        || 'Active';

      if (!campusSchoolsMap[campusId]) {
        campusSchoolsMap[campusId] = { campusId, campusName, schools: {} };
      }
      if (!campusSchoolsMap[campusId].schools[school]) {
        campusSchoolsMap[campusId].schools[school] = {
          school,
          students: 0,
          activeCount: 0,
          internsInCampus: 0,
          internsOutCampus: 0,
          openForPlacements: 0,
          placedCount: 0,
          placements: 0,
          placementReady: 0,
          readinessPending: 0,
          cycleNotAllocated: 0,
          communicationReady: 0
        };
      }

      const s = campusSchoolsMap[campusId].schools[school];
      const statusKey = (studentStatus || '').trim();
      const statusKeyNorm = statusKey.toLowerCase();
      if (statusKeyNorm === 'active') s.activeCount++;
      if (statusKeyNorm === 'intern (in campus)') s.internsInCampus++;
      if (statusKeyNorm === 'intern (out campus)') s.internsOutCampus++;
      if (['active', 'intern (in campus)', 'intern (out campus)'].includes(statusKeyNorm)) {
        s.openForPlacements++;
      }
      // Placed This Cycle: Count only if placed in current month (Ghar-synced dateOfPlacement)
      if (statusKeyNorm.includes('placed')) {
        const placementDate = student.studentProfile?.dateOfPlacement;
        if (placementDate) {
          const pDate = new Date(placementDate);
          if (pDate >= monthStart && pDate <= monthEnd) {
            s.placedCount++;
          }
        }
      }
      if (isReady) s.placementReady++;
      if (statusKeyNorm === 'active' && !isReady) s.readinessPending++;
      const hasCycle = !!student.placementCycle;
      if (!hasCycle) {
        const joining = student.studentProfile?.joiningDate ? new Date(student.studentProfile.joiningDate) : null;
        if (joining) {
          const months = (new Date().getFullYear() - joining.getFullYear()) * 12 + (new Date().getMonth() - joining.getMonth());
          if (months >= 12 && ['active', 'intern (in campus)', 'intern (out campus)'].includes(statusKeyNorm)) {
            s.cycleNotAllocated++;
          }
        }
      }
      const isComm = (() => {
        const gharSpeak = student.studentProfile?.externalData?.ghar?.englishSpeaking?.value;
        const gharWrite = student.studentProfile?.externalData?.ghar?.englishWriting?.value;
        const localSpeak = student.studentProfile?.englishProficiency?.speaking;
        const localWrite = student.studentProfile?.englishProficiency?.writing;
        const speak = (gharSpeak || localSpeak || '').toUpperCase();
        const write = (gharWrite || localWrite || '').toUpperCase();
        const good = ['B2', 'C1', 'C2'];
        return good.includes(speak) && good.includes(write);
      })();
      if (isComm) s.communicationReady++;
    });

    // Derive per-school totals similarly from their buckets
    Object.values(campusSchoolsMap).forEach(c => {
      Object.values(c.schools).forEach(s => {
        s.students = (s.activeCount || 0) + (s.internsInCampus || 0) + (s.internsOutCampus || 0);
      });
    });

    // Derive totalStudents for each campus by summing its schools when available,
    // otherwise fall back to status buckets for compatibility.
    Object.values(campusMap).forEach(c => {
      const schoolEntry = campusSchoolsMap[c.campusId];
      if (schoolEntry && Object.keys(schoolEntry.schools || {}).length > 0) {
        const sumFromSchools = Object.values(schoolEntry.schools).reduce((sum, sch) => sum + (sch.students || 0), 0);
        c.totalStudents = sumFromSchools;
      } else {
        c.totalStudents = (c.activeCount || 0) + (c.internsInCampus || 0) + (c.internsOutCampus || 0);
      }
    });

    // Build a map of campus._id -> placementTarget for quick lookup
    const campusTargetMap = {};
    allCampusDocs.forEach(doc => {
      campusTargetMap[doc._id.toString()] = doc.placementTarget || 0;
    });

    // Build campus breakdown with percentages, sorted by placementReady % desc
    const campusBreakdown = Object.values(campusMap).map(c => {
      const totalStudentsComputed = c.totalStudents || ((c.activeCount || 0) + (c.internsInCampus || 0) + (c.internsOutCampus || 0));
      const denom = totalStudentsComputed || 1;
      const target = campusTargetMap[c.campusId] || 0;
      const fyPlaced = c.fyPlaced || 0;
      const fyIntern = c.fyIntern || 0;
      const achievementPct = target > 0 ? parseFloat(((fyPlaced + fyIntern) / target * 100).toFixed(1)) : null;
      return {
        totalActive: c.activeCount || totalStudentsComputed || 0,
        totalStudents: totalStudentsComputed,
        ...c,
        placementTarget: target,
        fyPlaced,
        fyIntern,
        achievementPct,
        placementReadyPct: denom > 0 ? parseFloat(((c.placementReady / denom) * 100).toFixed(1)) : 0,
        readinessPendingPct: denom > 0 ? parseFloat(((c.readinessPending / denom) * 100).toFixed(1)) : 0,
        cycleNotAllocatedPct: denom > 0 ? parseFloat(((c.cycleNotAllocated / denom) * 100).toFixed(1)) : 0,
        communicationReadyPct: denom > 0 ? parseFloat(((c.communicationReady / denom) * 100).toFixed(1)) : 0
      };
    }).sort((a, b) => b.placementReadyPct - a.placementReadyPct);

    // Fetch placements grouped by campus+school for the students we considered
    const placementsBySchoolAgg = await Application.aggregate([
      { $match: { student: { $in: studentIds }, status: 'selected' } },
      { $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: 'studentData' } },
      { $unwind: '$studentData' },
      { $group: { _id: { campus: '$studentData.campus', school: '$studentData.studentProfile.currentSchool' }, count: { $sum: 1 } } }
    ]);

    placementsBySchoolAgg.forEach(p => {
      const campusId = (p._id.campus || '').toString() || 'unknown';
      const school = p._id.school || 'Unknown School';
      if (!campusSchoolsMap[campusId]) {
        campusSchoolsMap[campusId] = { campusId, campusName: 'Unknown Campus', schools: {} };
      }
      if (!campusSchoolsMap[campusId].schools[school]) {
        campusSchoolsMap[campusId].schools[school] = {
          school,
          students: 0,
          activeCount: 0,
          internsInCampus: 0,
          internsOutCampus: 0,
          openForPlacements: 0,
          placedCount: 0,
          placements: 0,
          placementReady: 0,
          readinessPending: 0,
          cycleNotAllocated: 0,
          communicationReady: 0
        };
      }
      campusSchoolsMap[campusId].schools[school].placements = p.count;
    });

    // Convert campusSchoolsMap to array with schools as list
    const campusSchools = Object.values(campusSchoolsMap).map(c => ({
      campusId: c.campusId,
      campusName: c.campusName,
      schools: Object.values(c.schools).sort((a, b) => b.students - a.students)
    }));

    res.json({
      roles: rolesData,
      campusBreakdown,
      campusSchools,
      fyYear: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
      cycle: activeCycle ? {
        name: activeCycle.name,
        target: activeCycle.targetPlacements,
        current: totalPlaced,
        id: activeCycle._id
      } : null
    });
  } catch (error) {
    try {
      const logDir = __dirname + '/../logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const out = `--- ${new Date().toISOString()} ---\n${error && error.stack ? error.stack : String(error)}\n\n`;
      fs.appendFileSync(logDir + '/talent-pipeline-error.log', out);
    } catch (e) {
      console.error('Failed to write talent-pipeline error log:', e);
    }
    console.error('Talent pipeline stats error:', error && error.stack ? error.stack : error);
    const payload = { message: 'Server error' };
    if (process.env.NODE_ENV !== 'production') {
      payload.error = error?.message || String(error);
      payload.stack = error?.stack;
    }
    res.status(500).json(payload);
  }
});

/**
 * @swagger
 * /api/stats/talent-pipeline/export:
 *   get:
 *     summary: Export talent pipeline student-wise data as XLS or PDF
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
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [xls, pdf]
 *     responses:
 *       200:
 *         description: Export file
 */
router.get('/talent-pipeline/export', auth, authorize('manager', 'coordinator', 'campus_poc'), async (req, res) => {
  try {
    const { campus, school, format = 'xls' } = req.query;

    let studentFilter = { role: 'student', isActive: true };
    if (campus) studentFilter.campus = campus;

    if (req.user.role === 'campus_poc') {
      const managedIds = getPOCManagedCampusIds(req.user);
      if (campus && !managedIds.includes(campus)) {
        return res.status(403).json({ message: 'Not authorized for this campus' });
      }
      if (!campus) {
        studentFilter.campus = { $in: managedIds };
      }
    }

    const students = await User.find(studentFilter)
      .select('firstName lastName campus studentProfile.currentSchool studentProfile.currentModule studentProfile.currentStatus studentProfile.currentStatus studentProfile.joiningDate studentProfile.dateOfPlacement studentProfile.enrollmentNumber studentProfile.externalData.ghar.stdId studentProfile.englishProficiency studentProfile.externalData.ghar.englishSpeaking studentProfile.externalData.ghar.englishWriting')
      .populate('campus', 'name');

    const readinessRecords = await StudentJobReadiness.find({ student: { $in: students.map(s => s._id) } })
      .select('student readinessPercentage isJobReady jobReady30At jobReady100At updatedAt');

    const readinessMap = new Map(
      readinessRecords.map((record) => [String(record.student), record])
    );

    const allCampusDocs = await Campus.find({ isActive: true }).select('_id placementTarget name');
    const campusTargetMap = {};
    allCampusDocs.forEach(doc => {
      campusTargetMap[doc._id.toString()] = doc.placementTarget || 0;
    });

    const campusSummaryMap = {};

    const sortText = (value) => (value || '').toString().toLowerCase();

    const studentRows = students
      .filter(student => !school || student.studentProfile?.currentSchool === school)
      .map(student => {
        const resolvedProfile = student.resolvedProfile || {};
        const readiness = readinessMap.get(String(student._id));
        const readinessPercentage = Number(readiness?.readinessPercentage || 0);
        const isPlacementReady = !!readiness?.isJobReady || readinessPercentage === 100;
        const statusValue = isPlacementReady ? 'Yes' : 'No';
        const campusId = student.campus?._id?.toString() || 'unknown';
        const campusName = student.campus?.name || 'Unknown Campus';
        const schoolName = student.studentProfile?.currentSchool || 'Unknown School';
        const statusKey = (resolvedProfile.currentStatus || student.studentProfile?.currentStatus || 'Active').trim().toLowerCase();
        const gharSpeak = student.studentProfile?.externalData?.ghar?.englishSpeaking?.value;
        const gharWrite = student.studentProfile?.externalData?.ghar?.englishWriting?.value;
        const localSpeak = student.studentProfile?.englishProficiency?.speaking;
        const localWrite = student.studentProfile?.englishProficiency?.writing;
        const speak = (gharSpeak || localSpeak || '').toUpperCase();
        const write = (gharWrite || localWrite || '').toUpperCase();
        const communicationReady = ['B2', 'C1', 'C2'].includes(speak) && ['B2', 'C1', 'C2'].includes(write) ? 'Yes' : 'No';
        const joiningDate = student.studentProfile?.joiningDate ? new Date(student.studentProfile.joiningDate) : null;
        const placementDate = student.studentProfile?.dateOfPlacement ? new Date(student.studentProfile.dateOfPlacement) : null;
        const fyNow = new Date();
        const fyStartYear = fyNow.getMonth() >= 3 ? fyNow.getFullYear() : fyNow.getFullYear() - 1;
        const fyStart = new Date(fyStartYear, 3, 1, 0, 0, 0);
        const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59);
        const inCurrentFy = placementDate && placementDate >= fyStart && placementDate <= fyEnd;
        const isIntern = statusKey === 'intern (in campus)' || statusKey === 'intern (out campus)';
        const isActive = statusKey === 'active';
        const isPlaced = statusKey.includes('placed');

        if (!campusSummaryMap[campusId]) {
          campusSummaryMap[campusId] = {
            campusId,
            campusName,
            target: campusTargetMap[campusId] || 0,
            achieved: 0,
            fyPlaced: 0,
            fyIntern: 0
          };
        }

        if (isPlaced && inCurrentFy) {
          campusSummaryMap[campusId].fyPlaced += 1;
        }
        if (isIntern && inCurrentFy) {
          campusSummaryMap[campusId].fyIntern += 1;
        }

        if (!isIntern && !isActive) {
          return null;
        }

        return {
          studentId: student.studentProfile?.externalData?.ghar?.stdId?.value || student.studentProfile?.enrollmentNumber || student._id.toString(),
          studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          campus: campusName,
          school: schoolName,
          joiningDate: joiningDate ? joiningDate.toLocaleDateString('en-IN') : '',
          currentModule: student.studentProfile?.currentModule || '',
          courseCompleted: `${readinessPercentage}%`,
          expectedPlacementReadyDate: '',
          communicationReady,
          placementReady: statusValue,
          bucket: isIntern ? 'intern' : 'active',
          sortCampus: sortText(campusName),
          sortSchool: sortText(schoolName),
          sortStudent: sortText(`${student.firstName || ''} ${student.lastName || ''}`.trim())
        };
      })
      .filter(Boolean);

    studentRows.sort((a, b) => {
      if (a.bucket !== b.bucket) return a.bucket === 'intern' ? -1 : 1;
      if (a.sortCampus !== b.sortCampus) return a.sortCampus.localeCompare(b.sortCampus);
      if (a.sortSchool !== b.sortSchool) return a.sortSchool.localeCompare(b.sortSchool);
      return a.sortStudent.localeCompare(b.sortStudent);
    });

    Object.values(campusSummaryMap).forEach(item => {
      item.achieved = item.fyPlaced + item.fyIntern;
      item.achievementPct = item.target > 0 ? parseFloat(((item.achieved / item.target) * 100).toFixed(1)) : null;
    });

    const campusList = Object.values(campusSummaryMap);
    const placementTarget = campusList.reduce((sum, item) => sum + Number(item.target || 0), 0);
    const achieved = campusList.reduce((sum, item) => sum + Number(item.achieved || 0), 0);
    const achievementPct = placementTarget > 0 ? parseFloat(((achieved / placementTarget) * 100).toFixed(1)) : null;
    const totalExported = studentRows.length || 1;
    const internRows = studentRows.filter(row => row.bucket === 'intern');
    const activeRows = studentRows.filter(row => row.bucket === 'active');
    const internPct = parseFloat(((internRows.length / totalExported) * 100).toFixed(1));
    const activePct = parseFloat(((activeRows.length / totalExported) * 100).toFixed(1));
    const communicationReadyCount = studentRows.filter(row => row.communicationReady === 'Yes').length;
    const communicationReadyPct = parseFloat(((communicationReadyCount / totalExported) * 100).toFixed(1));
    const placementReadyCount = studentRows.filter(row => row.placementReady === 'Yes').length;
    const placementReadyPct = parseFloat(((placementReadyCount / totalExported) * 100).toFixed(1));

    const selectedCampusDoc = campus ? allCampusDocs.find(doc => doc._id.toString() === campus) : null;
    const reportMeta = {
      campus: selectedCampusDoc?.name || (campus ? 'Selected Campus' : 'All Campuses'),
      school: school || 'All Schools',
      exportedOn: new Date().toLocaleDateString('en-IN'),
      placementTarget,
      achieved,
      achievementPct,
      internRows: internRows.length,
      internPct,
      activeRows: activeRows.length,
      activePct,
      communicationReadyCount,
      communicationReadyPct,
      placementReadyCount,
      placementReadyPct
    };

    const baseName = `talent_pipeline_${(campus || 'all').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${(school || 'all').replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 24
      });

      doc.pipe(res);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 24;
      const contentWidth = pageWidth - margin * 2;

      const cols = [56, 88, 76, 102, 74, 72, 64, 76, 68, 56];
      const headers = ['StudentID', 'Student Name', 'Campus', 'School', 'Date of Joining', 'Current Module', '% Completed', 'Expected Ready Date', 'Comm. Ready', 'Ready'];

      const clipText = (value, maxLength = 30) => {
        const text = (value ?? '').toString();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
      };

      const drawSummary = () => {
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(18).text('Campus Talent Pipeline Export', margin, 22);
        doc.fillColor('#64748b').font('Helvetica').fontSize(9).text(`Campus: ${reportMeta.campus}  |  School: ${reportMeta.school}  |  Exported on: ${reportMeta.exportedOn}`, margin, 44);

        const summaryTop = 62;
        const summaryGap = 12;
        const boxW = (contentWidth - summaryGap * 2) / 3;
        const boxH = 42;
        const boxes = [
          { label: 'Placement Target', value: String(reportMeta.placementTarget), color: '#1d4ed8' },
          { label: 'Achieved', value: String(reportMeta.achieved), color: '#059669' },
          { label: 'Achievement %', value: reportMeta.achievementPct === null ? '-' : `${reportMeta.achievementPct}%`, color: '#7c3aed' }
        ];

        boxes.forEach((box, index) => {
          const x = margin + index * (boxW + summaryGap);
          doc.roundedRect(x, summaryTop, boxW, boxH, 8).fillAndStroke('#f8fafc', '#e2e8f0');
          doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text(box.label.toUpperCase(), x + 10, summaryTop + 9, { width: boxW - 20 });
          doc.fillColor(box.color).font('Helvetica-Bold').fontSize(16).text(box.value, x + 10, summaryTop + 21, { width: boxW - 20 });
        });

        const statTop = summaryTop + boxH + 10;
        const statW = (contentWidth - 24) / 3;
        const statBoxes = [
          { label: 'Interns', value: `${reportMeta.internRows} (${reportMeta.internPct}%)`, color: '#0f766e' },
          { label: 'Communication Ready', value: `${reportMeta.communicationReadyCount} (${reportMeta.communicationReadyPct}%)`, color: '#2563eb' },
          { label: 'Placement Ready', value: `${reportMeta.placementReadyCount} (${reportMeta.placementReadyPct}%)`, color: '#16a34a' }
        ];

        statBoxes.forEach((box, index) => {
          const x = margin + index * (statW + 12);
          doc.roundedRect(x, statTop, statW, 34, 8).fillAndStroke('#ffffff', '#e2e8f0');
          doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(7).text(box.label.toUpperCase(), x + 10, statTop + 8, { width: statW - 20 });
          doc.fillColor(box.color).font('Helvetica-Bold').fontSize(12).text(box.value, x + 10, statTop + 18, { width: statW - 20 });
        });
      };

      const drawTableHeader = (y) => {
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#475569');
        doc.rect(margin, y, contentWidth, 18).fill('#f8fafc');
        let x = margin;
        headers.forEach((header, index) => {
          doc.fillColor('#475569').text(header, x + 3, y + 5, { width: cols[index] - 6, align: 'left' });
          x += cols[index];
        });
      };

      const drawRow = (row, y) => {
        const rowHeight = 18;
        doc.font('Helvetica').fontSize(7).fillColor('#0f172a');
        let x = margin;
        const values = [
          row.studentId,
          row.studentName,
          row.campus,
          row.school,
          row.joiningDate,
          row.currentModule,
          row.courseCompleted,
          row.expectedPlacementReadyDate,
          row.communicationReady,
          row.placementReady
        ];
        values.forEach((value, index) => {
          doc.rect(x, y, cols[index], rowHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
          doc.text(clipText(value, index === 1 || index === 3 || index === 5 ? 22 : 16), x + 3, y + 5, {
            width: cols[index] - 6,
            height: rowHeight - 6,
            ellipsis: true
          });
          x += cols[index];
        });
      };

      drawSummary();

      const drawSection = (title, rows, startY) => {
        let cursorY = startY;
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text(title, margin, cursorY);
        cursorY += 12;
        drawTableHeader(cursorY);
        cursorY += 18;

        rows.forEach((row) => {
          if (cursorY > pageHeight - margin - 22) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 24 });
            cursorY = margin;
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text(title, margin, cursorY);
            cursorY += 12;
            drawTableHeader(cursorY);
            cursorY += 18;
          }
          drawRow(row, cursorY);
          cursorY += 18;
        });

        return cursorY;
      };

      let cursorY = 160;
      cursorY = drawSection('Interns', internRows, cursorY);
      cursorY += 10;
      if (activeRows.length > 0) {
        cursorY = drawSection('Active', activeRows, cursorY);
      }

      doc.end();
      return;
    }

    const headers = [
      'StudentID',
      'Student Name',
      'Campus',
      'School',
      'Date of Joining',
      'Current Module',
      '% of Course Completed',
      'Expected Placement Ready Date',
      'Communication Ready',
      'Placement Ready (Yes/No)'
    ];

    const escapeCell = (value) => (value ?? '').toString().replace(/\t/g, ' ').replace(/\n/g, ' ').trim();
    const summaryRows = [
      ['Placement Target', reportMeta.placementTarget],
      ['Achieved', reportMeta.achieved],
      ['Achievement %', reportMeta.achievementPct === null ? '-' : `${reportMeta.achievementPct}%`],
      ['Campus', reportMeta.campus],
      ['School', reportMeta.school],
      ['Exported On', reportMeta.exportedOn],
      []
    ];

    const internRowsTsv = internRows.map(row => ([
      row.studentId,
      row.studentName,
      row.campus,
      row.school,
      row.joiningDate,
      row.currentModule,
      row.courseCompleted,
      row.expectedPlacementReadyDate,
      row.communicationReady,
      row.placementReady
    ].map(escapeCell).join('\t')));

    const activeRowsTsv = activeRows.map(row => ([
      row.studentId,
      row.studentName,
      row.campus,
      row.school,
      row.joiningDate,
      row.currentModule,
      row.courseCompleted,
      row.expectedPlacementReadyDate,
        row.communicationReady,
      row.placementReady
    ].map(escapeCell).join('\t')));

    const tsv = [
      ...summaryRows.map(row => row.join('\t')),
      `Interns (${internRows.length})`,
      headers.join('\t'),
      ...internRowsTsv,
      [],
      `Active (${activeRows.length})`,
      headers.join('\t'),
      ...activeRowsTsv
    ].join('\n');

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xls"`);
    res.send(tsv);
  } catch (error) {
    console.error('Talent pipeline export error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
