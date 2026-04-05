const express        = require('express');
const router         = express.Router();
const UserPreference = require('../models/UserPreference');

// ── GET /api/preferences ─────────────────────────────────────
// Returns the authenticated user's stored preferences.
// 204 if no preferences have been saved yet.
router.get('/', async (req, res) => {
  try {
    const pref = await UserPreference.findOne({ userId: req.user.id });
    if (!pref || !pref.palette) return res.status(204).end();
    res.json({ palette: pref.palette });
  } catch (err) {
    console.error('GET /preferences error:', err.message);
    res.status(500).json({ error: 'Failed to load preferences.' });
  }
});

// ── PUT /api/preferences/palette ─────────────────────────────
// Upserts the colour palette for the authenticated user.
router.put('/palette', async (req, res) => {
  const { name, bg, primary, secondary, accent } = req.body;

  if (!bg || !primary || !secondary || !accent) {
    return res.status(400).json({
      error: 'All palette fields are required: bg, primary, secondary, accent.'
    });
  }

  try {
    const pref = await UserPreference.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { palette: { name: name || 'Custom', bg, primary, secondary, accent } } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ palette: pref.palette });
  } catch (err) {
    console.error('PUT /preferences/palette error:', err.message);
    res.status(500).json({ error: 'Failed to save palette.' });
  }
});

// ── DELETE /api/preferences/palette ──────────────────────────
// Clears the stored palette so the app falls back to its defaults.
router.delete('/palette', async (req, res) => {
  try {
    await UserPreference.findOneAndUpdate(
      { userId: req.user.id },
      { $unset: { palette: '' } },
      { upsert: true }
    );
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /preferences/palette error:', err.message);
    res.status(500).json({ error: 'Failed to reset palette.' });
  }
});

module.exports = router;
