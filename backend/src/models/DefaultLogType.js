const mongoose = require('mongoose');

/**
 * DefaultLogType — account-agnostic, read-only log types shared across all users.
 * Stored in the "defaultlogtypes" collection.
 * Seeded once from defaultLogTypes.json on app startup.
 * Users cannot create, edit, or delete these.
 */
const defaultLogTypeSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, unique: true },
    domain:    { type: String, enum: ['work', 'personal', 'family'], required: true },
    category:  { type: String, default: '' },
    color:     { type: String, default: '#9B9B9B' },
    icon:      { type: String, default: '' },
    isBuiltIn: { type: Boolean, default: true },
    isActive:  { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'defaultlogtypes' }
);

defaultLogTypeSchema.index({ domain: 1, category: 1 });

module.exports = mongoose.model('DefaultLogType', defaultLogTypeSchema);
