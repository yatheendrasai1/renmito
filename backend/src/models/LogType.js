const mongoose = require('mongoose');

const logTypeSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name:      { type: String, required: true },
    domain:    { type: String, enum: ['work', 'personal', 'family'], required: true },
    category:  { type: String, default: '' },
    color:     { type: String, default: '#9B9B9B' },
    icon:      { type: String, default: '' },
    isBuiltIn: { type: Boolean, default: false },
    isActive:  { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'logtypes' }
);

logTypeSchema.index({ userId: 1, name: 1 }, { unique: true });
logTypeSchema.index({ isBuiltIn: 1, domain: 1 });

module.exports = mongoose.model('LogType', logTypeSchema);
