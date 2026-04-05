const express        = require('express');
const router         = express.Router();
const UserPreference = require('../models/UserPreference');

const MAX_PRESETS = 10;

// ── GET /api/preferences ─────────────────────────────────────
// Returns the authenticated user's stored preferences.
// 204 if no document exists yet.
router.get('/', async (req, res) => {
  try {
    const pref = await UserPreference.findOne({ userId: req.user.id });
    if (!pref) return res.status(204).end();
    res.json({
      palette:       pref.palette       ?? null,
      customPresets: pref.customPresets ?? [],
    });
  } catch (err) {
    console.error('GET /preferences error:', err.message);
    res.status(500).json({ error: 'Failed to load preferences.' });
  }
});

// ── PUT /api/preferences/palette ─────────────────────────────
// Upserts the currently active colour palette.
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
// Clears the active palette so the app falls back to its defaults.
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

// ── POST /api/preferences/presets ────────────────────────────
// Adds a named custom preset. Rejects if the user already has 10.
router.post('/presets', async (req, res) => {
  const { name, bg, primary, secondary, accent } = req.body;

  if (!name || !bg || !primary || !secondary || !accent) {
    return res.status(400).json({
      error: 'All preset fields are required: name, bg, primary, secondary, accent.'
    });
  }

  try {
    // Fetch current doc first so we can check the count
    const existing = await UserPreference.findOne({ userId: req.user.id });
    const current  = existing?.customPresets ?? [];

    if (current.length >= MAX_PRESETS) {
      return res.status(422).json({
        error: `Maximum of ${MAX_PRESETS} custom presets allowed. Delete one before adding another.`
      });
    }

    const pref = await UserPreference.findOneAndUpdate(
      { userId: req.user.id },
      { $push: { customPresets: { name, bg, primary, secondary, accent } } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ customPresets: pref.customPresets });
  } catch (err) {
    console.error('POST /preferences/presets error:', err.message);
    res.status(500).json({ error: 'Failed to save preset.' });
  }
});

// ── DELETE /api/preferences/presets/:name ─────────────────────
// Removes the custom preset with the given name for the user.
router.delete('/presets/:name', async (req, res) => {
  const { name } = req.params;

  try {
    const pref = await UserPreference.findOneAndUpdate(
      { userId: req.user.id },
      { $pull: { customPresets: { name } } },
      { new: true }
    );
    if (!pref) return res.status(404).json({ error: 'No preferences found.' });
    res.json({ customPresets: pref.customPresets });
  } catch (err) {
    console.error('DELETE /preferences/presets/:name error:', err.message);
    res.status(500).json({ error: 'Failed to delete preset.' });
  }
});

module.exports = router;
