const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const PostPlacementTracking = require('../models/PostPlacementTracking');
const DailyTracker = require('../models/DailyTracker');

const CHALLENGE_STATUSES = ['No Challenge', 'Resolved', 'Partially Resolved', 'Unresolved'];

const getTodayKey = () => new Date().toISOString().slice(0, 10);
const getCurrentMonthKey = () => getTodayKey().slice(0, 7);

const isValidDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const requirePlacement = async (studentId) => {
  return PostPlacementTracking.findOne({ student: studentId }).select('_id joiningDate internshipStartDate').lean();
};

const validatePayload = (body) => {
  const projectName = String(body.projectName || '').trim();
  const tasksPerformed = String(body.tasksPerformed || '').trim();
  const challengeStatus = body.challengeStatus || 'No Challenge';

  if (!projectName) return { error: 'Project worked on is required' };
  if (!tasksPerformed) return { error: 'Tasks performed are required' };
  if (!CHALLENGE_STATUSES.includes(challengeStatus)) return { error: 'Invalid challenge status' };

  return {
    value: {
      projectName,
      tasksPerformed,
      challengesFaced: String(body.challengesFaced || '').trim(),
      resolution: String(body.resolution || '').trim(),
      challengeStatus,
      supportRequired: String(body.supportRequired || '').trim(),
      additionalNotes: String(body.additionalNotes || '').trim()
    }
  };
};

const getExpectedDays = (placement) => {
  const startValue = placement?.joiningDate || placement?.internshipStartDate;
  if (!startValue) return 0;

  const start = new Date(startValue);
  const today = new Date(`${getTodayKey()}T00:00:00.000Z`);
  start.setUTCHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || start > today) return 0;

  return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
};

const buildSummary = async (studentId, placement) => {
  const [daysTracked, challengeCounts, lifelinesUsed] = await Promise.all([
    DailyTracker.countDocuments({ student: studentId }),
    DailyTracker.aggregate([
      { $match: { student: studentId, challengeStatus: { $ne: 'No Challenge' } } },
      { $group: { _id: '$challengeStatus', count: { $sum: 1 } } }
    ]),
    DailyTracker.countDocuments({
      student: studentId,
      date: { $gte: `${getCurrentMonthKey()}-01`, $lt: getTodayKey() }
    })
  ]);

  const counts = challengeCounts.reduce((result, item) => {
    result[item._id] = item.count;
    return result;
  }, {});
  const totalChallenges = Object.values(counts).reduce((total, count) => total + count, 0);
  const totalDaysExpected = getExpectedDays(placement);
  const missingUpdates = Math.max(0, totalDaysExpected - daysTracked);
  const attendancePercentage = totalDaysExpected > 0
    ? Math.round((daysTracked / totalDaysExpected) * 100)
    : null;

  return {
    totalDaysExpected,
    daysTracked,
    updatesSubmitted: daysTracked,
    daysPresent: daysTracked,
    daysAbsent: missingUpdates,
    missingUpdates,
    attendancePercentage,
    totalChallenges,
    resolvedChallenges: counts.Resolved || 0,
    partiallyResolvedChallenges: counts['Partially Resolved'] || 0,
    unresolvedChallenges: counts.Unresolved || 0
    ,lifelinesUsed
    ,lifelinesRemaining: Math.max(0, 3 - lifelinesUsed)
  };
};

router.use(auth, authorize('student'));

router.get('/me', async (req, res) => {
  try {
    const placement = await requirePlacement(req.userId);
    if (!placement) {
      return res.status(403).json({ message: 'Post-placement dashboard is available after placement' });
    }

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 5;
    const entries = await DailyTracker.find({ student: req.userId })
      .sort({ date: -1 })
      .limit(limit)
      .lean();
    const today = entries.find((entry) => entry.date === getTodayKey()) || await DailyTracker.findOne({ student: req.userId, date: getTodayKey() }).lean();

    res.json({
      today: today || null,
      entries,
      summary: await buildSummary(req.userId, placement)
    });
  } catch (error) {
    console.error('Get daily tracker error:', error);
    res.status(500).json({ message: 'Failed to load daily tracker' });
  }
});

router.post('/me', async (req, res) => {
  try {
    const placement = await requirePlacement(req.userId);
    if (!placement) {
      return res.status(403).json({ message: 'Post-placement dashboard is available after placement' });
    }

    const validation = validatePayload(req.body);
    if (validation.error) return res.status(400).json({ message: validation.error });

    const today = getTodayKey();
    const date = req.body.date || today;
    if (!isValidDateKey(date)) return res.status(400).json({ message: 'Invalid tracker date' });
    if (date > today) return res.status(400).json({ message: 'Tracker date cannot be in the future' });

    const existing = await DailyTracker.findOne({ student: req.userId, date }).select('_id');
    if (existing) {
      return res.status(409).json({ message: date === today ? 'A daily update has already been submitted for today' : 'A daily update already exists for this date' });
    }

    if (date !== today) {
      if (date.slice(0, 7) !== getCurrentMonthKey()) {
        return res.status(400).json({ message: 'Lifeline entries are available only for missed dates in the current month' });
      }
      const lifelinesUsed = await DailyTracker.countDocuments({
        student: req.userId,
        date: { $gte: `${getCurrentMonthKey()}-01`, $lt: today }
      });
      if (lifelinesUsed >= 3) {
        return res.status(400).json({ message: 'You have used all 3 lifelines for this month' });
      }
    }

    const entry = await DailyTracker.create({
      student: req.userId,
      date,
      ...validation.value
    });

    res.status(201).json({ message: 'Daily update submitted successfully', entry });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A daily update has already been submitted for today' });
    }
    console.error('Create daily tracker error:', error);
    res.status(500).json({ message: 'Failed to submit daily update' });
  }
});

router.put('/me/today', async (req, res) => {
  try {
    const placement = await requirePlacement(req.userId);
    if (!placement) {
      return res.status(403).json({ message: 'Post-placement dashboard is available after placement' });
    }

    const validation = validatePayload(req.body);
    if (validation.error) return res.status(400).json({ message: validation.error });

    const entry = await DailyTracker.findOneAndUpdate(
      { student: req.userId, date: getTodayKey() },
      { $set: validation.value },
      { new: true, runValidators: true }
    );

    if (!entry) return res.status(404).json({ message: 'No daily update exists for today' });
    res.json({ message: 'Daily update updated successfully', entry });
  } catch (error) {
    console.error('Update daily tracker error:', error);
    res.status(500).json({ message: 'Failed to update daily update' });
  }
});

module.exports = router;
