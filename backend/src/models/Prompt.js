const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema(
  {
    type:      { type: String, enum: ['system', 'custom'], default: 'custom' },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    insightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Insight', default: null },
    content:   { type: String, required: true }
  },
  { timestamps: true, collection: 'prompts' }
);

promptSchema.index({ accountId: 1 });

module.exports = mongoose.model('Prompt', promptSchema);
