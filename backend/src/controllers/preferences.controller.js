const preferencesService = require('../services/preferences.service');

// ─── GET /api/preferences ─────────────────────────────────────────────────────
async function getPreferences(req, res) {
  try {
    const prefs = await preferencesService.getPreferences(req.user.userId);
    if (!prefs) return res.status(204).end();
    res.json(prefs);
  } catch (err) {
    console.error('GET /preferences error:', err.message);
    res.status(500).json({ error: 'Failed to load preferences.' });
  }
}

// ─── PUT /api/preferences/theme ──────────────────────────────────────────────
async function setTheme(req, res) {
  try {
    const { theme } = req.body;
    if (theme !== 'light' && theme !== 'dark') {
      return res.status(400).json({ error: 'theme must be "light" or "dark".' });
    }
    const result = await preferencesService.updateTheme(req.user.userId, theme);
    res.json(result.data);
  } catch (err) {
    console.error('PUT /preferences/theme error:', err.message);
    res.status(500).json({ error: 'Failed to save theme.' });
  }
}

// ─── PUT /api/preferences/active-log ─────────────────────────────────────────
async function startActiveLog(req, res) {
  try {
    const { logTypeId, title, plannedMins } = req.body;
    if (!logTypeId) {
      return res.status(400).json({ error: 'logTypeId is required.' });
    }
    const result = await preferencesService.startActiveLog(req.user.userId, {
      logTypeId,
      title:       title       ?? '',
      plannedMins: plannedMins ?? null,
    });
    res.json(result.data);
  } catch (err) {
    console.error('PUT /preferences/active-log error:', err.message);
    res.status(500).json({ error: 'Failed to start active log.' });
  }
}

// ─── DELETE /api/preferences/active-log ──────────────────────────────────────
async function stopActiveLog(req, res) {
  try {
    const result = await preferencesService.stopActiveLog(req.user.userId);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /preferences/active-log error:', err.message);
    res.status(500).json({ error: 'Failed to stop active log.' });
  }
}

// ─── PUT /api/preferences/quick-shortcuts ─────────────────────────────────────
async function updateQuickShortcuts(req, res) {
  try {
    const { shortcuts } = req.body;
    if (!Array.isArray(shortcuts)) {
      return res.status(400).json({ error: 'shortcuts must be an array.' });
    }
    const result = await preferencesService.updateQuickShortcuts(req.user.userId, shortcuts);
    res.json(result.data);
  } catch (err) {
    console.error('PUT /preferences/quick-shortcuts error:', err.message);
    res.status(500).json({ error: 'Failed to save quick shortcuts.' });
  }
}

// ─── PUT /api/preferences/day-settings ───────────────────────────────────────
async function updateDaySettings(req, res) {
  try {
    const result = await preferencesService.updateDaySettings(req.user.userId, req.body);
    res.json(result.data);
  } catch (err) {
    console.error('PUT /preferences/day-settings error:', err.message);
    res.status(500).json({ error: 'Failed to save day settings.' });
  }
}

// ─── PUT /api/preferences/user-profile ───────────────────────────────────────
async function updateUserProfile(req, res) {
  try {
    const result = await preferencesService.updateUserProfile(req.user.userId, req.body);
    res.json(result.data);
  } catch (err) {
    console.error('PUT /preferences/user-profile error:', err.message);
    res.status(500).json({ error: 'Failed to save user profile.' });
  }
}

// ─── PUT /api/preferences/features ───────────────────────────────────────────
async function updateFeatures(req, res) {
  try {
    const result = await preferencesService.updateFeatures(req.user.userId, req.body);
    res.json(result.data);
  } catch (err) {
    console.error('PUT /preferences/features error:', err.message);
    res.status(500).json({ error: 'Failed to save features.' });
  }
}

// ─── PUT /api/preferences/expense-guide ──────────────────────────────────────
async function updateExpenseGuide(req, res) {
  try {
    const result = await preferencesService.updateExpenseGuide(req.user.userId, req.body);
    res.json(result.data);
  } catch (err) {
    console.error('PUT /preferences/expense-guide error:', err.message);
    res.status(500).json({ error: 'Failed to save expense guide settings.' });
  }
}

module.exports = {
  getPreferences,
  setTheme,
  startActiveLog,
  stopActiveLog,
  updateQuickShortcuts,
  updateDaySettings,
  updateUserProfile,
  updateFeatures,
  updateExpenseGuide,
};
