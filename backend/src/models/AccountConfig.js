const mongoose = require('mongoose');

const accountConfigSchema = new mongoose.Schema(
  {
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    geminiApiKey:   { type: String, default: '' },
    geminiVerified: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'accountConfigs' }
);

module.exports = mongoose.model('AccountConfig', accountConfigSchema);
