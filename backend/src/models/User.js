const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    userName:     { type: String, required: true, unique: true },
    email:        { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    creationType: { type: String, enum: ['credBased', 'sso'], required: true },
    timezone:     { type: String, default: 'UTC' },
    isActive:     { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'users' }
);

module.exports = mongoose.model('User', userSchema);
