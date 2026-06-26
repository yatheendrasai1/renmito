const svc = require('../services/locationPoints.service');

async function list(req, res) {
  try {
    res.json(await svc.list(req.user.userId));
  } catch (err) {
    console.error('GET /location-points error:', err.message);
    res.status(500).json({ error: 'Failed to fetch location points.' });
  }
}

async function create(req, res) {
  try {
    const { name, lat, lng, radius } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '`name` is required.' });
    if (typeof lat !== 'number' || typeof lng !== 'number')
      return res.status(400).json({ error: '`lat` and `lng` must be numbers.' });
    const r = typeof radius === 'number' && radius >= 1 && radius <= 500 ? radius : 10;
    const doc = await svc.create(req.user.userId, { name: name.trim(), lat, lng, radius: r });
    res.status(201).json(doc);
  } catch (err) {
    console.error('POST /location-points error:', err.message);
    res.status(500).json({ error: 'Failed to create location point.' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await svc.remove(req.user.userId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /location-points error:', err.message);
    res.status(500).json({ error: 'Failed to delete location point.' });
  }
}

module.exports = { list, create, remove };
