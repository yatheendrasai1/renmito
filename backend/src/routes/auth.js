const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const config   = require('../config');
const User     = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { userId: user._id, userName: user.userName, email: user.email },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { userName, email, password, timezone } = req.body;

  if (!userName || !email || !password) {
    return res.status(400).json({ error: 'userName, email and password are required.' });
  }

  const existing = await User.findOne({ $or: [{ email }, { userName }] });
  if (existing) {
    const field = existing.email === email ? 'email' : 'userName';
    return res.status(409).json({ error: `That ${field} is already taken.` });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    userName,
    email,
    passwordHash,
    creationType: 'credBased',
    timezone: timezone || 'UTC',
    isActive: true
  });

  // Default log types live in the shared "defaultlogtypes" collection —
  // no per-user seeding needed.

  const token = signToken(user);
  res.status(201).json({
    token,
    user: { id: user._id, userName: user.userName, email: user.email }
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'Account is deactivated.' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user._id, userName: user.userName, email: user.email }
  });
});

module.exports = router;
