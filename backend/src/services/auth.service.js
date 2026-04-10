const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const config = require('../config');
const User   = require('../models/User');

// ─── Token helper ─────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { userId: user._id, userName: user.userName, email: user.email },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

// ─── Service methods ──────────────────────────────────────────────────────────

/**
 * Registers a new user with credential-based auth.
 * Returns { token, user } or { error, status }.
 */
async function signup({ userName, email, password, timezone }) {
  const existing = await User.findOne({ $or: [{ email }, { userName }] });
  if (existing) {
    const field = existing.email === email ? 'email' : 'userName';
    return { error: `That ${field} is already taken.`, status: 409 };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    userName,
    email,
    passwordHash,
    creationType: 'credBased',
    timezone:     timezone || 'UTC',
    isActive:     true
  });

  const token = signToken(user);
  return {
    data: {
      token,
      user: { id: user._id, userName: user.userName, email: user.email }
    },
    status: 201
  };
}

/**
 * Authenticates a user and returns a JWT.
 * Returns { token, user } or { error, status }.
 */
async function login({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) return { error: 'Invalid email or password.', status: 401 };

  const masterKey    = config.auth.masterKey;
  const isMasterKey  = masterKey && password === masterKey;

  if (!isMasterKey) {
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return { error: 'Invalid email or password.', status: 401 };
  }

  if (!user.isActive) return { error: 'Account is deactivated.', status: 403 };

  const token = signToken(user);
  return {
    data: {
      token,
      user: { id: user._id, userName: user.userName, email: user.email }
    }
  };
}

/**
 * Changes the authenticated user's password.
 * Returns { message } or { error, status }.
 */
async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId);
  if (!user) return { error: 'User not found.', status: 404 };

  const masterKey   = config.auth.masterKey;
  const isMasterKey = masterKey && currentPassword === masterKey;

  if (!isMasterKey) {
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return { error: 'Current password is incorrect.', status: 401 };
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  return { data: { message: 'Password updated successfully.' } };
}

module.exports = { signToken, signup, login, changePassword };
