const mongoose = require('mongoose');

const timeLogSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // logTypeSource tells Mongoose which collection to populate logTypeId from.
    // 'DefaultLogType' → defaultlogtypes  |  'LogType' → logtypes
    logTypeSource:   { type: String, enum: ['DefaultLogType', 'LogType'], default: null },
    logTypeId:       { type: mongoose.Schema.Types.ObjectId, refPath: 'logTypeSource', default: null },
    title:           { type: String, required: true },
    description:     { type: String, default: '' },
    startAt:         { type: Date, required: true },
    endAt:           { type: Date, default: null },
    status:          { type: String, enum: ['running', 'completed', 'cancelled'], default: 'completed' },
    durationMins:    { type: Number, default: null },
    ticketId:        { type: String, default: '' },
    tags:            [{ type: String }],
    source:          { type: String, enum: ['manual', 'auto', 'imported', 'ai'], default: 'manual' },
    entryType:       { type: String, enum: ['range', 'point'], default: 'range' },
    lastHeartbeatAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'timelogs' }
);

// Indexes as per schema spec
timeLogSchema.index({ userId: 1, startAt: -1 });
timeLogSchema.index({ userId: 1, startAt: 1, endAt: 1 });
timeLogSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'running' } }
);

module.exports = mongoose.model('TimeLog', timeLogSchema);
