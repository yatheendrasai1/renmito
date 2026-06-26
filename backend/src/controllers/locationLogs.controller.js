const locationLogsSvc = require('../services/locationLogs.service');

// POST /api/location-logs/sync
async function sync(req, res) {
  try {
    const { coordinates } = req.body;

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(400).json({ error: '`coordinates` must be a non-empty array.' });
    }

    for (const c of coordinates) {
      if (typeof c.lat !== 'number' || typeof c.lng !== 'number' || !c.timestamp) {
        return res.status(400).json({ error: 'Each coordinate must have numeric lat, lng, and a timestamp.' });
      }
    }

    const doc = await locationLogsSvc.bulkInsert(req.user.userId, coordinates);
    res.status(200).json({ id: doc._id, count: coordinates.length });
  } catch (err) {
    console.error('POST /location-logs/sync error:', err.message);
    res.status(500).json({ error: 'Failed to sync location logs.' });
  }
}

// GET /api/location-logs
async function getAll(req, res) {
  try {
    const logs = await locationLogsSvc.getByUser(req.user.userId);
    res.json(logs);
  } catch (err) {
    console.error('GET /location-logs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch location logs.' });
  }
}

module.exports = { sync, getAll };
