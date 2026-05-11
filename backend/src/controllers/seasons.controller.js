const service = require('../services/seasons.service');

async function listSeasons(req, res) {
  try {
    res.json(await service.listSeasons(req.user.userId));
  } catch (err) {
    console.error('seasons.listSeasons:', err.message);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
}

async function createSeason(req, res) {
  try {
    const { name, startDate } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Season name is required' });
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
      return res.status(400).json({ error: 'Valid startDate (YYYY-MM-DD) is required' });
    res.status(201).json(await service.createSeason(req.user.userId, { name: name.trim(), startDate }));
  } catch (err) {
    console.error('seasons.createSeason:', err.message);
    res.status(500).json({ error: 'Failed to create season' });
  }
}

async function updateSeason(req, res) {
  try {
    const { id } = req.params;
    const patch = req.body || {};
    res.json(await service.updateSeason(req.user.userId, id, patch));
  } catch (err) {
    console.error('seasons.updateSeason:', err.message);
    if (err.message === 'Season not found') return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update season' });
  }
}

async function deleteSeason(req, res) {
  try {
    await service.deleteSeason(req.user.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('seasons.deleteSeason:', err.message);
    if (err.message === 'Season not found') return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to delete season' });
  }
}

module.exports = { listSeasons, createSeason, updateSeason, deleteSeason };
