const express        = require('express');
const router         = express.Router();
const LogType        = require('../models/LogType');
const DefaultLogType = require('../models/DefaultLogType');

const SORT = { domain: 1, category: 1, name: 1 };

// ─── GET /api/logtypes ────────────────────────────────────────────────────────
// Returns the merged list of:
//   1. Account-agnostic default log types  (source: 'default', read-only)
//   2. User-specific log types             (source: 'user',    editable)
router.get('/', async (req, res) => {
  const [defaults, userTypes] = await Promise.all([
    DefaultLogType.find({ isActive: true }).sort(SORT).lean(),
    LogType.find({ userId: req.user.userId, isActive: true }).sort(SORT).lean()
  ]);

  const result = [
    ...defaults.map(lt  => ({ ...lt, source: 'default' })),
    ...userTypes.map(lt => ({ ...lt, source: 'user' }))
  ];

  res.json(result);
});

// ─── POST /api/logtypes ───────────────────────────────────────────────────────
// Creates a new log type scoped to the authenticated user.
router.post('/', async (req, res) => {
  const { name, domain, category, color, icon } = req.body;

  if (!name || !domain) {
    return res.status(400).json({ error: 'name and domain are required.' });
  }

  const logType = await LogType.create({
    userId:    req.user.userId,
    name,
    domain,
    category:  category || '',
    color:     color    || '#9B9B9B',
    icon:      icon     || '',
    isBuiltIn: false,
    isActive:  true
  });

  res.status(201).json({ ...logType.toObject(), source: 'user' });
});

// ─── PUT /api/logtypes/:id ────────────────────────────────────────────────────
// Rename a user-owned log type (name only).
router.put('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name is required.' });
  }

  const logType = await LogType.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.userId },
    { $set: { name: name.trim() } },
    { new: true }
  );

  if (!logType) return res.status(404).json({ error: 'Log type not found.' });

  res.json({ ...logType.toObject(), source: 'user' });
});

// ─── DELETE /api/logtypes/:id ─────────────────────────────────────────────────
// Soft-deletes a user-owned log type (preserves _id so existing log refs stay valid).
router.delete('/:id', async (req, res) => {
  const logType = await LogType.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.userId },
    { $set: { isActive: false } }
  );

  if (!logType) return res.status(404).json({ error: 'Log type not found.' });

  res.json({ message: 'Log type deleted.' });
});

module.exports = router;
