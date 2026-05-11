const service = require('../services/episodes.service');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getEpisode(req, res) {
  try {
    const { date } = req.params;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format' });
    res.json(await service.getEpisode(req.user.userId, date));
  } catch (err) {
    console.error('episodes.getEpisode:', err.message);
    res.status(500).json({ error: 'Failed to fetch episode' });
  }
}

async function upsertEpisode(req, res) {
  try {
    const { date } = req.params;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format' });
    const { episodeName, content, seasonId } = req.body || {};
    res.json(await service.upsertEpisode(req.user.userId, date, { episodeName, content, seasonId }));
  } catch (err) {
    console.error('episodes.upsertEpisode:', err.message);
    res.status(500).json({ error: 'Failed to save episode' });
  }
}

module.exports = { getEpisode, upsertEpisode };
