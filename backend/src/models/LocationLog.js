const mongoose = require('mongoose');

const coordinateSchema = new mongoose.Schema(
  {
    lat:       { type: Number, required: true },
    lng:       { type: Number, required: true },
    timestamp: { type: Date,   required: true },
  },
  { _id: false }
);

const locationLogSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    coordinates: { type: [coordinateSchema], required: true },
    syncedAt:    { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'locationlogs' }
);

locationLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('LocationLog', locationLogSchema);
