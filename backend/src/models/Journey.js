const mongoose = require('mongoose');

const journeyConfigSchema = new mongoose.Schema(
  {
    metricName:    { type: String, default: '' },
    valueType:     { type: String, enum: ['numeric', 'categorical'], default: 'numeric' },
    allowedValues: [{ type: String }]
  },
  { _id: false }
);

const derivedFromSchema = new mongoose.Schema(
  {
    logTypeId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    logTypeName: { type: String, default: '' },
    valueMetric: { type: String, enum: ['duration', 'count', 'start-time', 'end-time'], default: 'duration' }
  },
  { _id: false }
);

const journeySchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:        { type: String, required: true },
    startDate:   { type: Date, required: true },
    span:        { type: String, enum: ['indefinite', 'definite'], required: true },
    endDate:     { type: Date, default: null },
    trackerType: { type: String, enum: ['point-log', 'derived'], required: true },
    status:      { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
    config:      { type: journeyConfigSchema, default: () => ({}) },
    derivedFrom: { type: derivedFromSchema, default: null }
  },
  { timestamps: true, collection: 'journeys' }
);

journeySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Journey', journeySchema);
