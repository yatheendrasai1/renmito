const aiSvc = require('../services/ai.service');

async function parseLog(req, res) {
  const { prompt, date } = req.body;
  if (!prompt || !date) {
    return res.status(400).json({ error: 'prompt and date are required.', code: 'INVALID_INPUT' });
  }
  const t0 = Date.now();
  try {
    const result = await aiSvc.parseLogPrompt(req.user.userId, prompt, date);
    console.log(`[AI] POST /ai/parse-log ok — ${result.length} item(s) in ${Date.now() - t0}ms`);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    console.error(`[AI] POST /ai/parse-log error (${status}) in ${Date.now() - t0}ms:`, err.message);
    res.status(status).json({ error: err.message || 'Failed to parse log.', code: err.code || 'UNKNOWN' });
  }
}

async function chat(req, res) {
  const { message, date } = req.body;
  if (!message || !date) {
    return res.status(400).json({ error: 'message and date are required.', code: 'INVALID_INPUT' });
  }
  const t0 = Date.now();
  try {
    const result = await aiSvc.chatWithRenni(req.user.userId, message, date);
    console.log(`[AI] POST /ai/chat ok — type=${result.type} in ${Date.now() - t0}ms`);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    console.error(`[AI] POST /ai/chat error (${status}) in ${Date.now() - t0}ms:`, err.message);
    res.status(status).json({ error: err.message || 'Chat failed.', code: err.code || 'UNKNOWN' });
  }
}

module.exports = { parseLog, chat };
