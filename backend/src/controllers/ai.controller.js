const aiSvc = require('../services/ai.service');

async function parseLog(req, res) {
  const { prompt, date } = req.body;
  if (!prompt || !date) {
    return res.status(400).json({ error: 'prompt and date are required.' });
  }
  try {
    const result = await aiSvc.parseLogPrompt(req.user.userId, prompt, date);
    console.error("result: ", result);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    console.error('POST /ai/parse-log error:', err.message);
    res.status(status).json({ error: err.message || 'Failed to parse log.' });
  }
}

async function chat(req, res) {
  const { message, date } = req.body;
  if (!message || !date) {
    return res.status(400).json({ error: 'message and date are required.' });
  }
  try {
    const result = await aiSvc.chatWithRenni(req.user.userId, message, date);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    console.error('POST /ai/chat error:', err.message);
    res.status(status).json({ error: err.message || 'Chat failed.' });
  }
}

module.exports = { parseLog, chat };
