const mongoose       = require('mongoose');
const TimeLog        = require('../models/TimeLog');
const LogType        = require('../models/LogType');
const DefaultLogType = require('../models/DefaultLogType');
const journeysSvc    = require('./journeys.service');

// ─── Constants ────────────────────────────────────────────────────────────────

const POPULATE_LOGTYPE = { path: 'logTypeId', select: 'name color domain category' };

// ─── Date / time helpers ──────────────────────────────────────────────────────

function toDate(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00.000Z`);
}

function toTimeStr(date) {
  if (!date) return null;
  return [
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0')
  ].join(':');
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

/** Map a populated TimeLog doc → API response shape. */
function toResponse(doc) {
  const lt = doc.logTypeId && typeof doc.logTypeId === 'object' ? doc.logTypeId : null;
  return {
    id:           doc._id.toString(),
    date:         toDateStr(doc.startAt),
    endDate:      doc.endAt ? toDateStr(doc.endAt) : null,
    startAt:      toTimeStr(doc.startAt),
    endAt:        toTimeStr(doc.endAt),
    title:        doc.title ?? '',
    durationMins: doc.durationMins ?? null,
    logType:      lt ? {
      id:       lt._id.toString(),
      name:     lt.name     ?? '',
      color:    lt.color    ?? '#9B9B9B',
      domain:   lt.domain   ?? '',
      category: lt.category ?? null
    } : null,
    logTypeSource: doc.logTypeSource ?? null,
    entryType:     doc.entryType     ?? 'range',
    ticketId:      doc.ticketId      ?? '',
    source:        doc.source        ?? 'manual',
    updatedAt:     doc.updatedAt     ?? doc.createdAt ?? null,
  };
}

/**
 * Validates a logTypeId against both collections.
 * Returns { id, source } or null.
 */
async function validateLogTypeId(logTypeId) {
  if (!logTypeId || !mongoose.Types.ObjectId.isValid(logTypeId)) return null;

  const inDefaults = await DefaultLogType.findById(logTypeId, '_id').lean();
  if (inDefaults) return { id: inDefaults._id, source: 'DefaultLogType' };

  const inUser = await LogType.findById(logTypeId, '_id').lean();
  if (inUser) return { id: inUser._id, source: 'LogType' };

  return null;
}

// ─── Service methods ──────────────────────────────────────────────────────────

/**
 * Returns all logs for a given date and user.
 */
async function getLogsByDate(userId, date) {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd   = new Date(`${date}T23:59:59.999Z`);

  const docs = await TimeLog
    .find({
      userId,
      $or: [
        { startAt: { $gte: dayStart, $lte: dayEnd } },
        { endAt:   { $gte: dayStart, $lte: dayEnd } },
      ]
    })
    .populate(POPULATE_LOGTYPE)
    .lean();

  return docs.map(toResponse);
}

/**
 * Creates a new log entry for a given date.
 * Returns the populated response object.
 */
async function createLog(userId, date, body) {
  const { startTime, endTime, title, logTypeId, entryType, pointTime, ticketId, source,
          startAtISO, endAtISO, pointAtISO, endDate } = body;
  const isPoint = entryType === 'point';

  const resolved = await validateLogTypeId(logTypeId);
  if (!resolved) return { error: 'Invalid logTypeId — log type not found.', status: 400 };

  // Accept full ISO datetimes when provided (Renni AI flow), otherwise build from date+time strings
  const startAt      = isPoint
    ? (pointAtISO ? new Date(pointAtISO) : toDate(date, pointTime))
    : (startAtISO  ? new Date(startAtISO)  : toDate(date, startTime));
  // endDate allows cross-midnight logs (e.g. sleep from 23:30 on day D to 07:00 on day D+1)
  const endAt        = isPoint ? null
    : (endAtISO ? new Date(endAtISO) : toDate(endDate || date, endTime));
  const durationMins = isPoint ? null : Math.round((endAt - startAt) / 60000);

  const created = await TimeLog.create({
    userId,
    logTypeId:     resolved.id,
    logTypeSource: resolved.source,
    title,
    ticketId:      ticketId ?? '',
    startAt,
    endAt,
    durationMins,
    entryType: isPoint ? 'point' : 'range',
    status:    'completed',
    source:    source === 'ai' ? 'ai' : 'manual'
  });

  const populated = await TimeLog.findById(created._id).populate(POPULATE_LOGTYPE).lean();
  journeysSvc.syncLogEntry(userId, created);
  return { data: toResponse(populated), status: 201 };
}

/**
 * Updates an existing log entry.
 * Returns the updated response object or an error.
 */
async function updateLog(userId, date, id, body) {
  const { startTime, endTime, title, logTypeId, entryType, pointTime, ticketId, endDate } = body;
  const isPoint = entryType === 'point';
  const updates = {};

  if (entryType !== undefined) updates.entryType = entryType;

  if (isPoint) {
    if (pointTime !== undefined) {
      updates.startAt      = toDate(date, pointTime);
      updates.endAt        = null;
      updates.durationMins = null;
    }
  } else {
    if (startTime !== undefined) updates.startAt = toDate(date, startTime);
    if (endTime   !== undefined) updates.endAt   = toDate(endDate || date, endTime);
    if (updates.startAt && updates.endAt) {
      updates.durationMins = Math.round((updates.endAt - updates.startAt) / 60000);
    }
  }

  if (title    !== undefined) updates.title    = title;
  if (ticketId !== undefined) updates.ticketId = ticketId;

  if (logTypeId !== undefined) {
    const resolved = await validateLogTypeId(logTypeId);
    if (!resolved) return { error: 'Invalid logTypeId — log type not found.', status: 400 };
    updates.logTypeId     = resolved.id;
    updates.logTypeSource = resolved.source;
  }

  const doc = await TimeLog
    .findOneAndUpdate({ _id: id, userId }, updates, { new: true })
    .populate(POPULATE_LOGTYPE)
    .lean();

  if (!doc) return { error: 'Log entry not found.', status: 404 };
  journeysSvc.syncLogEntry(userId, doc);
  return { data: toResponse(doc) };
}

/**
 * Hard-deletes a log entry owned by the user.
 */
async function deleteLog(userId, id) {
  const doc = await TimeLog.findOneAndDelete({ _id: id, userId });
  if (!doc) return { error: 'Log entry not found.', status: 404 };
  journeysSvc.unsyncLogEntry(doc._id);
  return { data: { message: 'Log entry deleted successfully.' } };
}

/**
 * Returns { "YYYY-MM-DD": totalWorkMins } for all work logs in a month
 * (domain=work, category!=transit).
 */
async function getMonthWorkSummary(userId, year, month) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const docs = await TimeLog
    .find({
      userId,
      startAt:      { $gte: monthStart, $lte: monthEnd },
      entryType:    'range',
      durationMins: { $gt: 0 }
    })
    .populate(POPULATE_LOGTYPE)
    .lean();

  const summary = {};
  for (const doc of docs) {
    const lt = doc.logTypeId && typeof doc.logTypeId === 'object' ? doc.logTypeId : null;
    if (!lt || lt.domain !== 'work' || lt.category === 'transit') continue;
    const dateStr = toDateStr(doc.startAt);
    summary[dateStr] = (summary[dateStr] || 0) + (doc.durationMins || 0);
  }

  return summary;
}

/**
 * Returns all logs in [startDate, endDate] (inclusive), excluding break and transit by category.
 * Adds startAtISO to each entry for full-precision datetime in the report view.
 */
async function getLogsByDateRange(userId, startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end   = new Date(`${endDate}T23:59:59.999Z`);

  const docs = await TimeLog
    .find({ userId, startAt: { $gte: start, $lte: end } })
    .populate(POPULATE_LOGTYPE)
    .sort({ startAt: 1 })
    .lean();

  return docs
    .filter(doc => {
      const lt = doc.logTypeId && typeof doc.logTypeId === 'object' ? doc.logTypeId : null;
      if (!lt) return false;
      return lt.domain === 'work' && lt.category !== 'break' && lt.category !== 'transit';
    })
    .map(doc => ({
      ...toResponse(doc),
      startAtISO: doc.startAt ? doc.startAt.toISOString() : null,
    }));
}

/**
 * Report-mode update: accepts full ISO startAt, durationMins, title, ticketId.
 * Recomputes endAt from startAt + durationMins.
 */
async function updateLogReport(userId, id, body) {
  const { title, ticketId, startAtISO, durationMins } = body;
  const updates = {};

  if (title    !== undefined) updates.title    = title;
  if (ticketId !== undefined) updates.ticketId = ticketId ?? '';

  if (startAtISO !== undefined) {
    const newStart = new Date(startAtISO);
    if (isNaN(newStart.getTime())) return { error: 'Invalid startAt date.', status: 400 };
    updates.startAt = newStart;
    if (durationMins !== undefined) {
      updates.durationMins = durationMins;
      updates.endAt = new Date(newStart.getTime() + durationMins * 60000);
    }
  } else if (durationMins !== undefined) {
    const existing = await TimeLog.findOne({ _id: id, userId }, 'startAt').lean();
    if (!existing) return { error: 'Log entry not found.', status: 404 };
    updates.durationMins = durationMins;
    updates.endAt = new Date(existing.startAt.getTime() + durationMins * 60000);
  }

  const doc = await TimeLog
    .findOneAndUpdate({ _id: id, userId }, updates, { new: true })
    .populate(POPULATE_LOGTYPE)
    .lean();

  if (!doc) return { error: 'Log entry not found.', status: 404 };
  journeysSvc.syncLogEntry(userId, doc);
  return { data: { ...toResponse(doc), startAtISO: doc.startAt?.toISOString() ?? null } };
}

module.exports = {
  getLogsByDate,
  createLog,
  updateLog,
  deleteLog,
  getMonthWorkSummary,
  getLogsByDateRange,
  updateLogReport,
};
