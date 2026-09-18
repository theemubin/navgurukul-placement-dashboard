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

async function evaluateInterestRequestReminders() {
  if (running) return;
  running = true;

  try {
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