const authService = require('../services/auth.service');

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
async function signup(req, res) {
  try {
    const { userName, email, password, timezone } = req.body;

    if (!userName || !email || !password) {
      return res.status(400).json({ error: 'userName, email and password are required.' });
    }

    const result = await authService.signup({ userName, email, password, timezone });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.data);
  } catch (err) {
    console.error('POST /auth/signup error:', err.message);
    res.status(500).json({ error: 'Signup failed.' });
  }
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const result = await authService.login({ email, password });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('POST /auth/login error:', err.message);
    res.status(500).json({ error: 'Login failed.' });
  }
}

// ─── POST /api/auth/change-password ──────────────────────────────────────────
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword must be at least 8 characters.' });
    }

    const result = await authService.changePassword(req.user.userId, { currentPassword, newPassword });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('POST /auth/change-password error:', err.message);
    res.status(500).json({ error: 'Password change failed.' });
  }
}

module.exports = { signup, login, changePassword };
