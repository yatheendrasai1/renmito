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

// ─── PUT /api/preferences/palette ────────────────────────────────────────────
async function upsertPalette(req, res) {
  try {
    const { bg, primary, secondary, accent } = req.body;

    if (!bg || !primary || !secondary || !accent) {
      return res.status(400).json({
        error: 'All palette fields are required: bg, primary, secondary, accent.'
      });
    }

    const result = await preferencesService.upsertPalette(req.user.userId, req.body);
    res.json(result);
  } catch (err) {
    console.error('PUT /preferences/palette error:', err.message);
    res.status(500).json({ error: 'Failed to save palette.' });
  }
}

// ─── DELETE /api/preferences/palette ─────────────────────────────────────────
async function clearPalette(req, res) {
  try {
    await preferencesService.clearPalette(req.user.userId);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /preferences/palette error:', err.message);
    res.status(500).json({ error: 'Failed to reset palette.' });
  }
}

// ─── POST /api/preferences/presets ───────────────────────────────────────────
async function addPreset(req, res) {
  try {
    const { name, bg, primary, secondary, accent } = req.body;

    if (!name || !bg || !primary || !secondary || !accent) {
      return res.status(400).json({
        error: 'All preset fields are required: name, bg, primary, secondary, accent.'
      });
    }

    const result = await preferencesService.addPreset(req.user.userId, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.data);
  } catch (err) {
    console.error('POST /preferences/presets error:', err.message);
    res.status(500).json({ error: 'Failed to save preset.' });
  }
}

// ─── DELETE /api/preferences/presets/:name ───────────────────────────────────
async function removePreset(req, res) {
  try {
    const result = await preferencesService.removePreset(req.user.userId, req.params.name);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('DELETE /preferences/presets/:name error:', err.message);
    res.status(500).json({ error: 'Failed to delete preset.' });
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

module.exports = {
  getPreferences,
  upsertPalette,
  clearPalette,
  addPreset,
  removePreset,
  startActiveLog,
  stopActiveLog,
  updateQuickShortcuts,
  updateDaySettings,
};
