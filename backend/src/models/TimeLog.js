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
    priority:        { type: String, enum: ['High', 'Medium', 'Low'], default: null },
    collaborators:   [{ type: String }],
    tags:               [{ type: String }],
    satisfactoryScore:  { type: Number, min: 1, max: 10, default: null },
    crucialPerson:      { type: String, enum: ['Yes', 'No', 'Shared'], default: null },
    jiraTicketId:      { type: String, default: null },      // internal JIRA issue ID
    jiraTicketKey:     { type: String, default: null },      // e.g. ENG-1234
    jiraTicketSummary: { type: String, default: null },      // cached title
    source:             { type: String, enum: ['manual', 'auto', 'imported', 'ai'], default: 'manual' },
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
