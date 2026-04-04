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

userSchema.index({ email:    1 }, { unique: true });
userSchema.index({ userName: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
