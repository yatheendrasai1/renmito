const service = require('../services/systemprompts.service');

async function getByPromptId(req, res) {
  try {
    const doc = await service.getByPromptId(req.params.promptId);
    if (!doc) return res.status(404).json({ error: 'System prompt not found' });
    res.json(doc);
  } catch (err) {
    console.error('systemprompts.getByPromptId:', err.message);
    res.status(500).json({ error: 'Failed to fetch system prompt' });
  }
}

module.exports = { getByPromptId };
