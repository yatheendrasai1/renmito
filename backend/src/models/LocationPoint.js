const mongoose = require('mongoose');

const locationPointSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:   { type: String, required: true, trim: true },
    lat:    { type: Number, required: true },
    lng:    { type: Number, required: true },
  },
  { timestamps: true, collection: 'locationpoints' }
);

module.exports = mongoose.model('LocationPoint', locationPointSchema);
