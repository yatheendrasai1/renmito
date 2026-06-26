const mongoose = require('mongoose');

const locationPointSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:   { type: String, required: true, trim: true },
    lat:    { type: Number, required: true },
    lng:    { type: Number, required: true },
    radius: { type: Number, required: true, default: 10, min: 1, max: 500 }, // metres
  },
  { timestamps: true, collection: 'locationpoints' }
);

module.exports = mongoose.model('LocationPoint', locationPointSchema);
