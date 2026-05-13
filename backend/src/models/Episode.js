const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date:         { type: String, required: true }, // YYYY-MM-DD — one per user per day
    seasonId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Season', default: null },
    episodeName:     { type: String, default: '' },
    content:         { type: String, default: '' },
    sentiment:       { label: { type: String, default: '' }, emoji: { type: String, default: '' } },
    startedWritingAt:{ type: Date, default: null },
    lastAccessAt:    { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'episodes' }
);

episodeSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Episode', episodeSchema);
