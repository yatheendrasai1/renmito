const mongoose    = require('mongoose');
const Journey     = require('../models/Journey');
const JourneyEntry = require('../models/JourneyEntry');
const TimeLog     = require('../models/TimeLog');
const DefaultLogType = require('../models/DefaultLogType');
const LogType     = require('../models/LogType');

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toJourneyResponse(doc) {
  return {
    id:          doc._id.toString(),
    name:        doc.name,
    startDate:   doc.startDate.toISOString().slice(0, 10),
    span:        doc.span,
    endDate:     doc.endDate ? doc.endDate.toISOString().slice(0, 10) : null,
    trackerType: doc.trackerType,
    status:      doc.status,
    config: {
      metricName:    doc.config?.metricName    ?? '',
      valueType:     doc.config?.valueType     ?? 'numeric',
      allowedValues: doc.config?.allowedValues ?? []
    },
    derivedFrom: doc.derivedFrom ? {
      logTypeId:   doc.derivedFrom.logTypeId.toString(),
      logTypeName: doc.derivedFrom.logTypeName ?? '',
      valueMetric: doc.derivedFrom.valueMetric ?? 'duration'
    } : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

function toEntryResponse(doc) {
  return {
    id:               doc._id.toString(),
    journeyId:        doc.journeyId.toString(),
    timestamp:        doc.timestamp.toISOString(),
    valueType:        doc.valueType,
    numericValue:     doc.numericValue     ?? null,
    categoricalValue: doc.categoricalValue ?? null,
    sourceLogId:      doc.sourceLogId ? doc.sourceLogId.toString() : null,
    createdAt:        doc.createdAt,
    updatedAt:        doc.updatedAt
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns minutes from midnight (UTC) for a Date, or null if date is falsy. */
function dateToMinsFromMidnight(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Compute the numeric value for a derived entry based on the value metric. */
function derivedNumericValue(logDoc, valueMetric) {
  switch (valueMetric) {
    case 'count':      return 1;
    case 'start-time': return dateToMinsFromMidnight(logDoc.startAt) ?? 0;
    case 'end-time':   return dateToMinsFromMidnight(logDoc.endAt)   ?? 0;
    case 'duration':
    default:           return logDoc.durationMins ?? 0;
  }
}

// ─── Validate log type exists ─────────────────────────────────────────────────

async function resolveLogType(logTypeId) {
  if (!logTypeId || !mongoose.Types.ObjectId.isValid(logTypeId)) return null;
  const inDefaults = await DefaultLogType.findById(logTypeId, '_id').lean();
  if (inDefaults) return inDefaults._id;
  const inUser = await LogType.findById(logTypeId, '_id').lean();
  if (inUser) return inUser._id;
  return null;
}

// ─── Journey CRUD ─────────────────────────────────────────────────────────────

async function listJourneys(userId) {
  const docs = await Journey.find({ userId }).sort({ createdAt: -1 }).lean();
  return docs.map(toJourneyResponse);
}

async function getJourney(userId, journeyId) {
  if (!mongoose.Types.ObjectId.isValid(journeyId)) {
    return { error: 'Invalid journey ID.', status: 400 };
  }
  const doc = await Journey.findOne({ _id: journeyId, userId }).lean();
  if (!doc) return { error: 'Journey not found.', status: 404 };
  return { data: toJourneyResponse(doc) };
}

async function createJourney(userId, body) {
  const { name, startDate, span, endDate, trackerType, config, derivedFrom } = body;

  if (span === 'definite' && !endDate) {
    return { error: 'endDate is required when span is definite.', status: 400 };
  }

  if (trackerType === 'derived') {
    if (!derivedFrom?.logTypeId) {
      return { error: 'derivedFrom.logTypeId is required for derived journeys.', status: 400 };
    }
    const resolvedId = await resolveLogType(derivedFrom.logTypeId);
    if (!resolvedId) {
      return { error: 'derivedFrom.logTypeId references a log type that does not exist.', status: 400 };
    }
  }

  const doc = await Journey.create({
    userId,
    name,
    startDate: new Date(startDate),
    span,
    endDate: span === 'definite' ? new Date(endDate) : null,
    trackerType,
    config: trackerType === 'derived' ? {
      metricName:    derivedFrom?.valueMetric === 'count' ? 'Count' : 'Duration (mins)',
      valueType:     'numeric',
      allowedValues: []
    } : {
      metricName:    config?.metricName    ?? '',
      valueType:     config?.valueType     ?? 'numeric',
      allowedValues: config?.allowedValues ?? []
    },
    derivedFrom: trackerType === 'derived' ? {
      logTypeId:   derivedFrom.logTypeId,
      logTypeName: derivedFrom.logTypeName ?? '',
      valueMetric: derivedFrom.valueMetric ?? 'duration'
    } : null
  });

  return { data: toJourneyResponse(doc.toObject()), status: 201 };
}

async function updateJourney(userId, journeyId, body) {
  if (!mongoose.Types.ObjectId.isValid(journeyId)) {
    return { error: 'Invalid journey ID.', status: 400 };
  }

  const updates = {};
  if (body.name       !== undefined) updates.name    = body.name;
  if (body.status     !== undefined) updates.status  = body.status;
  if (body.span       !== undefined) updates.span    = body.span;
  if (body.endDate    !== undefined) updates.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.config     !== undefined) updates.config  = body.config;
  if (body.derivedFrom !== undefined) {
    if (body.derivedFrom === null) {
      updates.derivedFrom = null;
    } else {
      if (body.derivedFrom.logTypeId) {
        const resolvedId = await resolveLogType(body.derivedFrom.logTypeId);
        if (!resolvedId) return { error: 'derivedFrom.logTypeId references a log type that does not exist.', status: 400 };
      }
      updates.derivedFrom = body.derivedFrom;
    }
  }

  const doc = await Journey.findOneAndUpdate({ _id: journeyId, userId }, updates, { new: true }).lean();
  if (!doc) return { error: 'Journey not found.', status: 404 };
  return { data: toJourneyResponse(doc) };
}

async function deleteJourney(userId, journeyId) {
  if (!mongoose.Types.ObjectId.isValid(journeyId)) {
    return { error: 'Invalid journey ID.', status: 400 };
  }
  const doc = await Journey.findOneAndDelete({ _id: journeyId, userId });
  if (!doc) return { error: 'Journey not found.', status: 404 };
  await JourneyEntry.deleteMany({ journeyId });
  return { data: { message: 'Journey deleted.' } };
}

// ─── Entry CRUD ───────────────────────────────────────────────────────────────

async function listEntries(userId, journeyId) {
  if (!mongoose.Types.ObjectId.isValid(journeyId)) {
    return { error: 'Invalid journey ID.', status: 400 };
  }
  const journey = await Journey.findOne({ _id: journeyId, userId }, '_id').lean();
  if (!journey) return { error: 'Journey not found.', status: 404 };

  const docs = await JourneyEntry.find({ journeyId }).sort({ timestamp: -1 }).lean();
  return { data: docs.map(toEntryResponse) };
}

async function addEntry(userId, journeyId, body) {
  if (!mongoose.Types.ObjectId.isValid(journeyId)) {
    return { error: 'Invalid journey ID.', status: 400 };
  }
  const journey = await Journey.findOne({ _id: journeyId, userId }).lean();
  if (!journey) return { error: 'Journey not found.', status: 404 };
  if (journey.trackerType === 'derived') {
    return { error: 'Entries for derived journeys are managed automatically.', status: 400 };
  }

  const { timestamp, valueType, numericValue, categoricalValue } = body;
  const isNumeric = valueType === 'numeric';

  const doc = await JourneyEntry.create({
    userId,
    journeyId,
    timestamp:        new Date(timestamp),
    valueType,
    numericValue:     isNumeric ? numericValue : null,
    categoricalValue: !isNumeric ? categoricalValue : null
  });

  return { data: toEntryResponse(doc.toObject()), status: 201 };
}

async function updateEntry(userId, journeyId, entryId, body) {
  if (!mongoose.Types.ObjectId.isValid(journeyId) || !mongoose.Types.ObjectId.isValid(entryId)) {
    return { error: 'Invalid ID.', status: 400 };
  }
  const journey = await Journey.findOne({ _id: journeyId, userId }, '_id').lean();
  if (!journey) return { error: 'Journey not found.', status: 404 };

  const updates = {};
  if (body.timestamp        !== undefined) updates.timestamp        = new Date(body.timestamp);
  if (body.numericValue     !== undefined) updates.numericValue     = body.numericValue;
  if (body.categoricalValue !== undefined) updates.categoricalValue = body.categoricalValue;

  const doc = await JourneyEntry.findOneAndUpdate({ _id: entryId, journeyId }, updates, { new: true }).lean();
  if (!doc) return { error: 'Entry not found.', status: 404 };
  return { data: toEntryResponse(doc) };
}

async function deleteEntry(userId, journeyId, entryId) {
  if (!mongoose.Types.ObjectId.isValid(journeyId) || !mongoose.Types.ObjectId.isValid(entryId)) {
    return { error: 'Invalid ID.', status: 400 };
  }
  const journey = await Journey.findOne({ _id: journeyId, userId }, '_id').lean();
  if (!journey) return { error: 'Journey not found.', status: 404 };

  const doc = await JourneyEntry.findOneAndDelete({ _id: entryId, journeyId });
  if (!doc) return { error: 'Entry not found.', status: 404 };
  return { data: { message: 'Entry deleted.' } };
}

// ─── Derived: auto-sync ───────────────────────────────────────────────────────

/**
 * Called after a log is created or updated.
 * Upserts journey entries for all derived journeys watching this log's type.
 * Also removes stale entries if the log's type changed.
 */
async function syncLogEntry(userId, logDoc) {
  try {
    const matchingJourneys = await Journey.find({
      userId,
      trackerType: 'derived',
      'derivedFrom.logTypeId': logDoc.logTypeId
    }).lean();

    const matchingIds = matchingJourneys.map(j => j._id);

    // Remove stale entries (log type was reassigned away from these journeys)
    if (matchingIds.length > 0) {
      await JourneyEntry.deleteMany({ sourceLogId: logDoc._id, journeyId: { $nin: matchingIds } });
    } else {
      await JourneyEntry.deleteMany({ sourceLogId: logDoc._id });
    }

    for (const journey of matchingJourneys) {
      const vm = journey.derivedFrom?.valueMetric ?? 'duration';
      const numericValue = derivedNumericValue(logDoc, vm);

      await JourneyEntry.findOneAndUpdate(
        { journeyId: journey._id, sourceLogId: logDoc._id },
        {
          $set: {
            userId,
            journeyId:        journey._id,
            sourceLogId:      logDoc._id,
            timestamp:        logDoc.startAt,
            valueType:        'numeric',
            numericValue,
            categoricalValue: null
          }
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error('[journeys] syncLogEntry error:', err.message);
  }
}

/**
 * Called after a log is deleted.
 * Removes all derived journey entries that reference this log.
 */
async function unsyncLogEntry(logId) {
  try {
    await JourneyEntry.deleteMany({ sourceLogId: logId });
  } catch (err) {
    console.error('[journeys] unsyncLogEntry error:', err.message);
  }
}

/**
 * Re-syncs all historical TimeLog entries for a derived journey.
 * Deletes existing auto-entries and rebuilds from the full log history.
 */
async function resyncDerivedJourney(userId, journeyId) {
  if (!mongoose.Types.ObjectId.isValid(journeyId)) {
    return { error: 'Invalid journey ID.', status: 400 };
  }
  const journey = await Journey.findOne({ _id: journeyId, userId }).lean();
  if (!journey) return { error: 'Journey not found.', status: 404 };
  if (journey.trackerType !== 'derived') {
    return { error: 'Journey is not a derived journey.', status: 400 };
  }

  const { logTypeId, valueMetric } = journey.derivedFrom;

  // Delete all auto-synced entries
  await JourneyEntry.deleteMany({ journeyId, sourceLogId: { $ne: null } });

  // Fetch all matching logs for this user
  const logs = await TimeLog.find({ userId, logTypeId }).lean();

  if (logs.length > 0) {
    const entries = logs.map(log => ({
      userId,
      journeyId:        journey._id,
      sourceLogId:      log._id,
      timestamp:        log.startAt,
      valueType:        'numeric',
      numericValue:     derivedNumericValue(log, valueMetric),
      categoricalValue: null
    }));
    await JourneyEntry.insertMany(entries);
  }

  const updated = await JourneyEntry.find({ journeyId }).sort({ timestamp: -1 }).lean();
  return { data: updated.map(toEntryResponse) };
}

module.exports = {
  listJourneys,
  getJourney,
  createJourney,
  updateJourney,
  deleteJourney,
  listEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  syncLogEntry,
  unsyncLogEntry,
  resyncDerivedJourney
};
