const DayLevelMetadata = require('../models/DayLevelMetadata');
const TimeLog          = require('../models/TimeLog');

/**
 * 1.83 — Returns the day-level metadata for a user + date.
 * Creates a default document (upsert) if none exists yet.
 * Also returns whether the day is a weekend so the frontend can
 * seed the correct default dayType.
 */
async function getOrCreateMetadata(userId, date) {
  const dayOfWeek = getDayOfWeek(date); // 0=Sun … 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let doc = await DayLevelMetadata.findOne({ userId, date });
  if (!doc) {
    doc = await DayLevelMetadata.findOneAndUpdate(
      { userId, date },
      {
        $setOnInsert: {
          userId,
          date,
          dayType:      isWeekend ? 'holiday' : 'working',
          importantLogs: {},
          capturedAt:    null,
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  return formatDoc(doc);
}

/**
 * Sets the day type flag (working / holiday / paid_leave / sick_leave / wfh).
 */
async function setDayType(userId, date, dayType) {
  const doc = await DayLevelMetadata.findOneAndUpdate(
    { userId, date },
    { $set: { dayType } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return formatDoc(doc);
}

/**
 * Captures the current important-log snapshot for the given date.
 * Looks up the relevant logs from the DB and stores a snapshot with
 * the time + logId + logUpdatedAt so the frontend can detect staleness later.
 *
 * Lookup windows:
 *   wokeUp    — sleep logs: prev-day 23:00 → current-day now   → latest, take endAt
 *   breakfast — breakfast logs: current-day 00:00 → 23:59      → earliest startAt
 *   lunch     — lunch logs:     current-day 00:00 → 23:59      → earliest startAt
 *   dinner    — dinner logs:    current-day 00:00 → 23:59      → earliest startAt
 *   sleep     — sleep logs: current-day 19:00 → next-day 05:00 → earliest, take startAt
 */
async function captureImportantLogs(userId, date) {
  const [year, month, day] = date.split('-').map(Number);

  // Build UTC boundaries (treat date string as local midnight UTC for simplicity;
  // the frontend sends the user's local date string, so we match on a wide window).
  const dayStart  = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const dayEnd    = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

  const prevDate  = new Date(Date.UTC(year, month - 1, day - 1, 23, 0, 0));
  const nextDate  = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0));
  const sleepFrom = new Date(Date.UTC(year, month - 1, day, 19, 0, 0));

  // Fetch all relevant logs in one query using refPath population
  const logs = await TimeLog.find({
    userId,
    startAt: { $gte: prevDate, $lte: nextDate },
    status:  { $ne: 'cancelled' },
  }).populate({ path: 'logTypeId', select: 'name category domain' })
    .lean();

  function isSleep(l) {
    const lt = l.logTypeId;
    if (!lt) return false;
    return lt.domain === 'personal' && lt.category === 'sleep';
  }
  function isMeal(l, mealName) {
    const lt = l.logTypeId;
    if (!lt) return false;
    const cat = (lt.category || '').toLowerCase();
    const name = (lt.name || '').toLowerCase();
    return lt.domain === 'personal' && (cat === mealName || name.includes(mealName));
  }

  function toEntry(log, timeDate) {
    if (!log || !timeDate) return null;
    const pad = n => String(n).padStart(2, '0');
    const d   = new Date(timeDate);
    const hh  = pad(d.getUTCHours());
    const mm  = pad(d.getUTCMinutes());
    const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return {
      logId:        log._id,
      time:         `${hh}:${mm}`,
      date:         dateStr,
      logUpdatedAt: log.updatedAt ?? log.createdAt ?? null,
    };
  }

  // wokeUp — sleep logs from prev-day 23:00 up to current-day end; latest endAt
  const wokeUpLogs = logs.filter(l =>
    isSleep(l) &&
    new Date(l.startAt) >= prevDate &&
    new Date(l.startAt) <= dayEnd &&
    l.endAt
  );
  wokeUpLogs.sort((a, b) => new Date(b.endAt) - new Date(a.endAt));
  const wokeUpLog = wokeUpLogs[0] ?? null;

  // breakfast / lunch / dinner — within current day
  const dayLogs = logs.filter(l =>
    new Date(l.startAt) >= dayStart && new Date(l.startAt) <= dayEnd
  );
  const bfLogs     = dayLogs.filter(l => isMeal(l, 'breakfast')).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const lunchLogs  = dayLogs.filter(l => isMeal(l, 'lunch')).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const dinnerLogs = dayLogs.filter(l => isMeal(l, 'dinner')).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

  // sleep start — sleep logs from current-day 19:00 to next-day 05:00; earliest startAt
  const sleepLogs = logs.filter(l =>
    isSleep(l) &&
    new Date(l.startAt) >= sleepFrom &&
    new Date(l.startAt) <= nextDate
  );
  sleepLogs.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const sleepLog = sleepLogs[0] ?? null;

  const importantLogs = {
    wokeUp:    toEntry(wokeUpLog,   wokeUpLog?.endAt   ?? null),
    breakfast: toEntry(bfLogs[0],   bfLogs[0]?.startAt ?? null),
    lunch:     toEntry(lunchLogs[0], lunchLogs[0]?.startAt ?? null),
    dinner:    toEntry(dinnerLogs[0], dinnerLogs[0]?.startAt ?? null),
    sleep:     toEntry(sleepLog,    sleepLog?.startAt  ?? null),
  };

  const doc = await DayLevelMetadata.findOneAndUpdate(
    { userId, date },
    { $set: { importantLogs, capturedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return formatDoc(doc);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function getDayOfWeek(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatDoc(doc) {
  return {
    date:          doc.date,
    dayType:       doc.dayType,
    importantLogs: {
      wokeUp:    doc.importantLogs?.wokeUp    ?? null,
      breakfast: doc.importantLogs?.breakfast ?? null,
      lunch:     doc.importantLogs?.lunch     ?? null,
      dinner:    doc.importantLogs?.dinner    ?? null,
      sleep:     doc.importantLogs?.sleep     ?? null,
    },
    capturedAt: doc.capturedAt ?? null,
  };
}

/**
 * 1.83 — Returns a map of { "YYYY-MM-DD": dayType } for all persisted records
 * in the given calendar month. Dates with no record are omitted (caller uses
 * day-of-week to determine default).
 */
async function getMonthDayTypes(userId, year, month) {
  const pad = n => String(n).padStart(2, '0');
  const prefix = `${year}-${pad(month)}-`;
  const docs = await DayLevelMetadata.find(
    { userId, date: { $regex: `^${prefix}` } },
    { date: 1, dayType: 1, _id: 0 }
  ).lean();
  const result = {};
  for (const d of docs) result[d.date] = d.dayType;
  return result;
}

module.exports = {
  getOrCreateMetadata,
  setDayType,
  captureImportantLogs,
  getMonthDayTypes,
};
