const express     = require('express');
const router      = express.Router();
const Enhancement = require('../models/Enhancement');

// GET /api/enhancements — all enhancements, sorted by version id
router.get('/', async (req, res) => {
  const list = await Enhancement.find({}).sort({ id: 1 }).lean();
  res.json(list);
});

// POST /api/enhancements — create a new enhancement entry
router.post('/', async (req, res) => {
  const { id, version, type, title, description, status, implementedAt,
          tags, relatedTo, requestedBy, breaking, notes } = req.body;

  if (!id || !version || !type || !title) {
    return res.status(400).json({ error: 'Missing required fields: id, version, type, title' });
  }

  const exists = await Enhancement.findOne({ id }).lean();
  if (exists) return res.status(409).json({ error: `Enhancement ${id} already exists.` });

  const doc = await Enhancement.create({
    id, version, type, title,
    description:   description   ?? '',
    status:        status        ?? 'implemented',
    implementedAt: implementedAt ? new Date(implementedAt) : null,
    tags:          tags          ?? [],
    relatedTo:     relatedTo     ?? [],
    requestedBy:   requestedBy   ?? 'owner',
    breaking:      breaking      ?? false,
    notes:         notes         ?? ''
  });

  res.status(201).json(doc);
});

module.exports = router;
