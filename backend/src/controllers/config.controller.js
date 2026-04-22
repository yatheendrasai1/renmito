const configSvc = require('../services/config.service');

async function getConfig(req, res) {
  try {
    const config = await configSvc.getConfig(req.user.userId);
    res.json(config);
  } catch (err) {
    console.error('GET /config error:', err.message);
    res.status(500).json({ error: 'Failed to get configuration.' });
  }
}

async function saveGeminiKey(req, res) {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'API key is required.' });
  }
  try {
    await configSvc.verifyAndSaveGeminiKey(req.user.userId, apiKey.trim());
    res.json({ success: true, message: 'Gemini API key verified and saved.' });
  } catch (err) {
    console.error('POST /config/gemini-key error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to verify API key.' });
  }
}

module.exports = { getConfig, saveGeminiKey };
