const express        = require('express');
const router         = express.Router();
const mongoose       = require('mongoose');
const TimeLog        = require('../models/TimeLog');
const LogType        = require('../models/LogType');
const DefaultLogType = require('../models/DefaultLogType');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// refPath on the TimeLog schema means Mongoose auto-selects the right collection.
const POPULATE_LOGTYPE = { path: 'logTypeId', select: 'name color domain category' };

// ─── helpers ─────────────────────────────────────────────────────────────────

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

/** Map a populated TimeLog doc → API response (fields match timelogs collection). */
function toResponse(doc) {
  const lt = doc.logTypeId && typeof doc.logTypeId === 'object' ? doc.logTypeId : null;
  return {
    id:           doc._id.toString(),
    date:         toDateStr(doc.startAt),
    startAt:      toTimeStr(doc.startAt),
    endAt:        toTimeStr(doc.endAt),
    title:        doc.title ?? '',
    durationMins: doc.durationMins ?? null,
    logType:      lt ? {
      id:       lt._id.toString(),
      name:     lt.name    ?? '',
      color:    lt.color   ?? '#9B9B9B',
      domain:   lt.domain  ?? '',
      category: lt.category ?? null
    } : null,
    logTypeSource: doc.logTypeSource ?? null,
    entryType:     doc.entryType ?? 'range'
  };
}

/**
 * Validates a logTypeId against both collections.
 * Checks defaultlogtypes first, then logtypes.
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

// ─── routes ──────────────────────────────────────────────────────────────────

// GET /api/logs/month/:year/:month
// Returns { "YYYY-MM-DD": totalWorkMins } for the month (domain=work, category!=transit).
router.get('/month/:year/:month', async (req, res) => {
  const y = parseInt(req.params.year,  10);
  const m = parseInt(req.params.month, 10); // 1-based

  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    return res.status(400).json({ error: 'Invalid year or month' });
  }

  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd   = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const docs = await TimeLog
    .find({
      userId:      req.user.userId,
      startAt:     { $gte: monthStart, $lte: monthEnd },
      entryType:   'range',
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

  res.json(summary);
});

// GET /api/logs/:date
router.get('/:date', async (req, res) => {
  const { date } = req.params;
  if (!DATE_REGEX.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd   = new Date(`${date}T23:59:59.999Z`);

  const docs = await TimeLog
    .find({ userId: req.user.userId, startAt: { $gte: dayStart, $lte: dayEnd } })
    .populate(POPULATE_LOGTYPE)
    .lean();

  res.json(docs.map(toResponse));
});

// POST /api/logs/:date
router.post('/:date', async (req, res) => {
  const { date } = req.params;
  if (!DATE_REGEX.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const { startTime, endTime, title, logTypeId, entryType, pointTime } = req.body;
  const isPoint = entryType === 'point';

  if (isPoint) {
    if (!pointTime || !title || !logTypeId) {
      return res.status(400).json({ error: 'Missing required fields: pointTime, title, logTypeId' });
    }
  } else {
    if (!startTime || !endTime || !title || !logTypeId) {
      return res.status(400).json({ error: 'Missing required fields: startTime, endTime, title, logTypeId' });
    }
  }

  const resolved = await validateLogTypeId(logTypeId);
  if (!resolved) {
    return res.status(400).json({ error: 'Invalid logTypeId — log type not found.' });
  }

  const startAt      = isPoint ? toDate(date, pointTime) : toDate(date, startTime);
  const endAt        = isPoint ? null                    : toDate(date, endTime);
  const durationMins = isPoint ? null                    : Math.round((endAt - startAt) / 60000);

  const created = await TimeLog.create({
    userId:        req.user.userId,
    logTypeId:     resolved.id,
    logTypeSource: resolved.source,
    title,
    startAt,
    endAt,
    durationMins,
    entryType:     isPoint ? 'point' : 'range',
    status:        'completed',
    source:        'manual'
  });

  const populated = await TimeLog.findById(created._id).populate(POPULATE_LOGTYPE).lean();
  res.status(201).json(toResponse(populated));
});

// PUT /api/logs/:date/:id
router.put('/:date/:id', async (req, res) => {
  const { date, id } = req.params;
  if (!DATE_REGEX.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const { startTime, endTime, title, logTypeId, entryType, pointTime } = req.body;
  const isPoint = entryType === 'point';
  const updates = {};

  if (entryType !== undefined)  updates.entryType = entryType;

  if (isPoint) {
    if (pointTime !== undefined) {
      updates.startAt      = toDate(date, pointTime);
      updates.endAt        = null;
      updates.durationMins = null;
    }
  } else {
    if (startTime !== undefined) updates.startAt = toDate(date, startTime);
    if (endTime   !== undefined) updates.endAt   = toDate(date, endTime);
    if (title     !== undefined) updates.title   = title;
    if (updates.startAt && updates.endAt) {
      updates.durationMins = Math.round((updates.endAt - updates.startAt) / 60000);
    }
  }
  if (title !== undefined) updates.title = title;

  if (logTypeId !== undefined) {
    const resolved = await validateLogTypeId(logTypeId);
    if (!resolved) {
      return res.status(400).json({ error: 'Invalid logTypeId — log type not found.' });
    }
    updates.logTypeId     = resolved.id;
    updates.logTypeSource = resolved.source;
  }

  const doc = await TimeLog
    .findOneAndUpdate({ _id: id, userId: req.user.userId }, updates, { new: true })
    .populate(POPULATE_LOGTYPE)
    .lean();

  if (!doc) return res.status(404).json({ error: 'Log entry not found.' });

  res.json(toResponse(doc));
});

// DELETE /api/logs/:date/:id
router.delete('/:date/:id', async (req, res) => {
  const { date, id } = req.params;
  if (!DATE_REGEX.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const doc = await TimeLog.findOneAndDelete({ _id: id, userId: req.user.userId });
  if (!doc) return res.status(404).json({ error: 'Log entry not found.' });

  res.json({ message: 'Log entry deleted successfully.' });
});

module.exports = router;
