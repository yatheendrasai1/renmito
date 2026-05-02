const mongoose = require('mongoose');

const icConfigSchema = new mongoose.Schema(
  {
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    geminiApiKey:   { type: String, default: '' },
    geminiVerified: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'icconfigs' }
);

module.exports = mongoose.model('IcConfig', icConfigSchema);
