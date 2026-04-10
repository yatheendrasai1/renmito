const enhancementsService = require('../services/enhancements.service');

// ─── GET /api/enhancements ────────────────────────────────────────────────────
async function listEnhancements(req, res) {
  try {
    const list = await enhancementsService.listEnhancements();
    res.json(list);
  } catch (err) {
    console.error('GET /enhancements error:', err.message);
    res.status(500).json({ error: 'Failed to fetch enhancements.' });
  }
}

// ─── POST /api/enhancements ───────────────────────────────────────────────────
async function createEnhancement(req, res) {
  try {
    const { id, version, type, title } = req.body;

    if (!id || !version || !type || !title) {
      return res.status(400).json({ error: 'Missing required fields: id, version, type, title' });
    }

    const result = await enhancementsService.createEnhancement(req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.data);
  } catch (err) {
    console.error('POST /enhancements error:', err.message);
    res.status(500).json({ error: 'Failed to create enhancement.' });
  }
}

module.exports = { listEnhancements, createEnhancement };
