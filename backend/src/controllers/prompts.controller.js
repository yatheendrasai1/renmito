const service = require('../services/prompts.service');

async function createPrompt(req, res) {
  try {
    const { content, insightId } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
    const result = await service.createPrompt(req.user.userId, { content, insightId });
    res.status(201).json(result);
  } catch (err) {
    console.error('prompts.createPrompt:', err.message);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
}

async function updatePrompt(req, res) {
  try {
    const { content } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content cannot be empty' });
    const result = await service.updatePrompt(req.user.userId, req.params.id, { content });
    res.json(result);
  } catch (err) {
    if (err.message === 'Not found') return res.status(404).json({ error: 'Prompt not found' });
    console.error('prompts.updatePrompt:', err.message);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
}

module.exports = { createPrompt, updatePrompt };
