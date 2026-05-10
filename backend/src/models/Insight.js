const mongoose = require('mongoose');

const insightSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true },
    label:     { type: String, required: true },
    type:      { type: String, enum: ['system', 'custom'], default: 'system' },
    promptId:  { type: mongoose.Schema.Types.Mixed, default: null },
    model:     { type: String, default: 'gemini' },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    enabled:   { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'insights' }
);

insightSchema.index({ accountId: 1 });
insightSchema.index({ label: 1 });

module.exports = mongoose.model('Insight', insightSchema);
