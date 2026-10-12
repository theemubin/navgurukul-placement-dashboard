const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const User = require('../models/User');
const PostPlacementTracking = require('../models/PostPlacementTracking');
const DailyTracker = require('../models/DailyTracker');

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const getExpectedDays = (placement) => {
  const startValue = placement.joiningDate || placement.internshipStartDate;
  if (!startValue) return 0;

  const start = new Date(startValue);
  const today = new Date(`${getTodayKey()}T00:00:00.000Z`);
  start.setUTCHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || start > today) return 0;
  return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
};

const getAllowedStudentIds = async (req) => {
  if (req.user.role !== 'campus_poc') return null;

  const campusIds = [];
  if (req.user.campus) campusIds.push(req.user.campus);
  if (Array.isArray(req.user.managedCampuses)) campusIds.push(...req.user.managedCampuses);
  if (campusIds.length === 0) return [];

  const students = await User.find({ role: 'student', campus: { $in: campusIds } }).select('_id').lean();
  return students.map((student) => student._id);
};

const getPlacementQuery = async (req) => {
  const studentIds = await getAllowedStudentIds(req);
  if (studentIds) return { student: { $in: studentIds } };
  return {};
};

const summarizeEntries = (placement, entries) => {
  const today = getTodayKey();
  const todayEntry = entries.find((entry) => entry.date === today) || null;
  const expectedDays = getExpectedDays(placement);
  const daysTracked = entries.length;
  const missingDays = Math.max(0, expectedDays - daysTracked);
  const challengeCounts = entries.reduce((result, entry) => {
    if (entry.challengeStatus && entry.challengeStatus !== 'No Challenge') {
      result[entry.challengeStatus] = (result[entry.challengeStatus] || 0) + 1;
    }
    return result;
  }, {});

  return {
    totalDaysExpected: expectedDays,
    daysTracked,
    presentWorkDays: daysTracked,
    missingDays,
    attendancePercentage: expectedDays > 0 ? Math.round((daysTracked / expectedDays) * 100) : null,
    totalChallenges: Object.values(challengeCounts).reduce((total, count) => total + count, 0),
    resolvedChallenges: challengeCounts.Resolved || 0,
    partiallyResolvedChallenges: challengeCounts['Partially Resolved'] || 0,
    unresolvedChallenges: challengeCounts.Unresolved || 0,
    todayStatus: todayEntry ? 'Submitted' : 'Pending',
    todayEntry,
    lastTrackerUpdate: entries[0]?.createdAt || null
  };
};

const buildProjects = (entries) => {
  const projects = entries.reduce((result, entry) => {
    const key = entry.projectName.trim();
    if (!result[key]) result[key] = { projectName: key, daysWorked: 0, latestDate: entry.date };
    result[key].daysWorked += 1;
    if (entry.date > result[key].latestDate) result[key].latestDate = entry.date;
    return result;
  }, {});
  return Object.values(projects).sort((left, right) => right.daysWorked - left.daysWorked || right.latestDate.localeCompare(left.latestDate));
};

const buildMonitoringRecord = async (placement, includeEntries = false) => {
  const entries = await DailyTracker.find({ student: placement.student._id })
    .sort({ date: -1 })
    .lean();
  const summary = summarizeEntries(placement, entries);
  const student = placement.student;
  const record = {
    studentId: student._id,
    studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
    studentEmail: student.email,
    companyName: placement.companyName,
    designation: placement.designation,
    employmentType: placement.employmentType,
    joiningDate: placement.joiningDate || placement.internshipStartDate || null,
    placementStatus: placement.status,
    hasFullTimeConversion: placement.hasFullTimeConversion,
    fullTimeConversionDate: placement.fullTimeConversionDate || null,
    ...summary,
    overallStatus: summary.unresolvedChallenges > 0
      ? 'Needs Attention'
      : summary.todayStatus === 'Pending'
        ? 'Update Pending'
        : 'On Track'
  };

  if (includeEntries) {
    record.entries = entries;
    record.projects = buildProjects(entries);
  }

  return record;
};

const loadPlacements = async (req) => {
  const query = await getPlacementQuery(req);
  return PostPlacementTracking.find(query)
    .populate('student', 'firstName lastName email campus')
    .sort({ createdAt: -1 })
    .lean();
};

router.use(auth, authorize('campus_poc', 'coordinator', 'manager'));

router.get('/', async (req, res) => {
  try {
    const placements = await loadPlacements(req);
    const records = await Promise.all(placements.map((placement) => buildMonitoringRecord(placement)));
    const {
      company,
      employmentType,
      joiningDateFrom,
      joiningDateTo,
      todayStatus,
      challengeStatus,
      search,
      attendanceMin,
      attendanceMax
    } = req.query;

    const searchTerm = String(search || '').trim().toLowerCase();
    const filtered = records.filter((record) => {
      if (employmentType && record.employmentType !== employmentType) return false;
      if (company && !String(record.companyName || '').toLowerCase().includes(String(company).toLowerCase())) return false;
      if (joiningDateFrom && (!record.joiningDate || new Date(record.joiningDate) < new Date(joiningDateFrom))) return false;
      if (joiningDateTo && (!record.joiningDate || new Date(record.joiningDate) > new Date(`${joiningDateTo}T23:59:59.999Z`))) return false;
      if (todayStatus && record.todayStatus !== todayStatus) return false;
      if (attendanceMin && (record.attendancePercentage === null || record.attendancePercentage < Number(attendanceMin))) return false;
      if (attendanceMax && (record.attendancePercentage === null || record.attendancePercentage > Number(attendanceMax))) return false;
      if (challengeStatus === 'Unresolved' && record.unresolvedChallenges === 0) return false;
      if (challengeStatus === 'Resolved' && record.resolvedChallenges === 0) return false;
      if (challengeStatus === 'Partially Resolved' && record.partiallyResolvedChallenges === 0) return false;
      if (challengeStatus === 'No Challenge' && record.totalChallenges > 0) return false;
      if (searchTerm && !`${record.studentName} ${record.companyName || ''}`.toLowerCase().includes(searchTerm)) return false;
      return true;
    });

    res.json({ placements: filtered, total: filtered.length });
  } catch (error) {
    console.error('Post-placement monitoring list error:', error);
    res.status(500).json({ message: 'Failed to load post-placement monitoring' });
  }
});

router.get('/:studentId', async (req, res) => {
  try {
    const query = await getPlacementQuery(req);
    if (query.student?.$in && !query.student.$in.some((studentId) => String(studentId) === String(req.params.studentId))) {
      return res.status(404).json({ message: 'Placed student not found' });
    }
    const placement = await PostPlacementTracking.findOne({ ...query, student: req.params.studentId })
      .populate('student', 'firstName lastName email campus')
      .lean();
    if (!placement) return res.status(404).json({ message: 'Placed student not found' });

    res.json(await buildMonitoringRecord(placement, true));
  } catch (error) {
    console.error('Post-placement monitoring detail error:', error);
    res.status(500).json({ message: 'Failed to load student monitoring details' });
  }
});

module.exports = router;
