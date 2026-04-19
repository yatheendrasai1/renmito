const mongoose = require('mongoose');

const journeyEntrySchema = new mongoose.Schema(
  {
    userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    journeyId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Journey', required: true },
    timestamp:        { type: Date, required: true },
    valueType:        { type: String, enum: ['numeric', 'categorical'], required: true },
    numericValue:     { type: Number, default: null },
    categoricalValue: { type: String, default: null },
    sourceLogId:      { type: mongoose.Schema.Types.ObjectId, ref: 'TimeLog', default: null }
  },
  { timestamps: true, collection: 'journeyentries' }
);

journeyEntrySchema.index({ journeyId: 1, timestamp: -1 });
journeyEntrySchema.index({ userId: 1, journeyId: 1 });
journeyEntrySchema.index({ sourceLogId: 1 }, { sparse: true });

module.exports = mongoose.model('JourneyEntry', journeyEntrySchema);
