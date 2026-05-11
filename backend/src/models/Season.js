const mongoose = require('mongoose');

const seasonSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:      { type: String, required: true, trim: true },
    startDate: { type: String, required: true }, // YYYY-MM-DD
  },
  { timestamps: true, collection: 'seasons' }
);

seasonSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Season', seasonSchema);
