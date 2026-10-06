const discordService = require('./discordService');

const TIME_ZONE = process.env.INTEREST_REQUEST_REMINDER_TIMEZONE || 'Asia/Kolkata';
const CHECK_INTERVAL_MS = 60 * 1000;

let intervalId = null;
let running = false;

function getZonedParts(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  return {
    hour: parseInt(pick('hour') || '0', 10),
    minute: parseInt(pick('minute') || '0', 10)
  };
}

function getDueSlot(date = new Date()) {
  const { hour, minute } = getZonedParts(date);

  if (hour === 10 && minute < 5) return 'morning';
  if (hour === 17 && minute < 5) return 'evening';

  return null;
}

async function expirePastDeadlineInterestRequests() {
  try {
    const InterestRequest = require('../models/InterestRequest');
    const Application = require('../models/Application');
    const now = new Date();

    const pendingRequests = await InterestRequest.find({ status: 'pending' }).populate('job');
    for (const req of pendingRequests) {
      if (req.job && req.job.applicationDeadline && new Date(req.job.applicationDeadline) < now) {
        req.status = 'rejected';
        req.rejectionReason = 'PoC has not approved before deadline';
        req.reviewNotes = 'Automatically rejected because Campus PoC did not approve before the application deadline.';
        req.reviewedAt = now;
        await req.save();

        await Application.updateMany(
          { student: req.student, job: req.job._id, applicationType: 'interest', status: { $in: ['applied', 'interested', 'pending'] } },
          {
            $set: {
              status: 'rejected',
              feedback: 'PoC has not approved before deadline',
              statusComment: 'PoC has not approved before deadline'
            },
            $push: {
              statusHistory: {
                status: 'rejected',
                changedAt: now,
                comment: 'PoC has not approved before deadline'
              }
            }
          }
        );
      }
    }
  } catch (err) {
    console.error('Scheduler error expiring past deadline interest requests:', err);
  }
}

async function evaluateInterestRequestReminders() {
  if (running) return;
  running = true;

  try {
    await expirePastDeadlineInterestRequests();

    const slot = getDueSlot();
    if (!slot) return;

    const result = await discordService.sendPendingInterestRequestDigest(slot);
    if (result?.error) {
      console.error(`Interest request digest failed for ${slot}:`, result.error);
    }
  } catch (error) {
    console.error('Interest request scheduler error:', error);
  } finally {
    running = false;
  }
}

function startInterestRequestScheduler() {
  if (intervalId) return intervalId;

  evaluateInterestRequestReminders().catch((error) => {
    console.error('Interest request scheduler initial run failed:', error);
  });

  intervalId = setInterval(() => {
    evaluateInterestRequestReminders().catch((error) => {
      console.error('Interest request scheduler tick failed:', error);
    });
  }, CHECK_INTERVAL_MS);

  return intervalId;
}

function stopInterestRequestScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = {
  startInterestRequestScheduler,
  stopInterestRequestScheduler,
  evaluateInterestRequestReminders
};