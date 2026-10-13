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
    const User = require('../models/User');
    const now = new Date();

    const pendingRequests = await InterestRequest.find({ status: 'pending' }).populate('job').populate('student');
    for (const req of pendingRequests) {
      if (req.job && req.job.applicationDeadline && new Date(req.job.applicationDeadline) < now) {
        // Atomic update: only transition if still pending to prevent duplicate processing
        const updated = await InterestRequest.findOneAndUpdate(
          { _id: req._id, status: 'pending' },
          {
            status: 'rejected',
            rejectionReason: 'PoC has not approved before deadline',
            reviewNotes: 'Automatically rejected because Campus PoC did not approve before the application deadline.',
            reviewedAt: now
          },
          { new: true }
        );

        // Only proceed with side effects if this process performed the transition
        if (updated) {
          try {
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
          } catch (appUpdateErr) {
            console.error(`Failed to update Application for rejected InterestRequest ${req._id}:`, appUpdateErr);
            console.error(`InterestRequest is 'rejected' but Application may still be 'interested'. Reconciliation will retry on next scheduler run.`);
            // Don't send Discord notification if Application update failed to avoid inconsistency
            return;
          }

          // Send Discord notification for auto-rejection
          try {
            await discordService.sendInterestRequestRejectionNotification(req, req.student, req.job);
          } catch (discordErr) {
            console.error('Failed to send Discord notification for auto-rejected interest request:', discordErr);
          }
        }
      }
    }
  } catch (err) {
    console.error('Scheduler error expiring past deadline interest requests:', err);
  }
}

// Reconciliation function to fix inconsistent states where InterestRequest is rejected but Application is not
async function reconcileRejectedInterestRequests() {
  try {
    const InterestRequest = require('../models/InterestRequest');
    const Application = require('../models/Application');
    const now = new Date();

    // Find rejected InterestRequests where the related Application is not rejected
    const inconsistentRequests = await InterestRequest.find({ status: 'rejected' }).populate('job');

    let fixedCount = 0;
    for (const req of inconsistentRequests) {
      // Skip if job was deleted
      if (!req.job) {
        continue;
      }

      const app = await Application.findOne({
        student: req.student,
        job: req.job._id,
        applicationType: 'interest',
        status: { $nin: ['rejected', 'withdrawn'] }
      });

      if (app) {
        try {
          await Application.updateOne(
            { _id: app._id },
            {
              $set: {
                status: 'rejected',
                feedback: 'PoC has not approved before deadline (reconciled)',
                statusComment: 'PoC has not approved before deadline (reconciled)'
              },
              $push: {
                statusHistory: {
                  status: 'rejected',
                  changedAt: now,
                  comment: 'PoC has not approved before deadline (reconciled)'
                }
              }
            }
          );
          fixedCount++;
          console.log(`Reconciled Application ${app._id} for rejected InterestRequest ${req._id}`);
        } catch (reconcileErr) {
          console.error(`Failed to reconcile Application ${app._id}:`, reconcileErr);
        }
      }
    }

    if (fixedCount > 0) {
      console.log(`Reconciliation: Fixed ${fixedCount} inconsistent Application records`);
    }
  } catch (err) {
    console.error('Reconciliation error:', err);
  }
}

async function evaluateInterestRequestReminders() {
  if (running) return;
  running = true;

  try {
    await expirePastDeadlineInterestRequests();

    // Run reconciliation to fix any inconsistent states from previous failures
    await reconcileRejectedInterestRequests();

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
  evaluateInterestRequestReminders,
  reconcileRejectedInterestRequests
};