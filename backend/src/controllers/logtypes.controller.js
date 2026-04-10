const logTypesService = require('../services/logtypes.service');

// ─── GET /api/logtypes ────────────────────────────────────────────────────────
async function getAllLogTypes(req, res) {
  try {
    const result = await logTypesService.getAllLogTypes(req.user.userId);
    res.json(result);
  } catch (err) {
    console.error('GET /logtypes error:', err.message);
    res.status(500).json({ error: 'Failed to fetch log types.' });
  }
}

// ─── POST /api/logtypes ───────────────────────────────────────────────────────
async function createLogType(req, res) {
  try {
    const { name, domain, category, color, icon } = req.body;

    if (!name || !domain) {
      return res.status(400).json({ error: 'name and domain are required.' });
    }

    const result = await logTypesService.createLogType(req.user.userId, { name, domain, category, color, icon });
    res.status(201).json(result);
  } catch (err) {
    console.error('POST /logtypes error:', err.message);
    res.status(500).json({ error: 'Failed to create log type.' });
  }
}

// ─── PUT /api/logtypes/:id ────────────────────────────────────────────────────
async function renameLogType(req, res) {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'name is required.' });
    }

    const result = await logTypesService.renameLogType(req.user.userId, req.params.id, name);
    if (!result) return res.status(404).json({ error: 'Log type not found.' });
    res.json(result);
  } catch (err) {
    console.error('PUT /logtypes/:id error:', err.message);
    res.status(500).json({ error: 'Failed to rename log type.' });
  }
}

// ─── DELETE /api/logtypes/:id ─────────────────────────────────────────────────
async function deleteLogType(req, res) {
  try {
    const deleted = await logTypesService.softDeleteLogType(req.user.userId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Log type not found.' });
    res.json({ message: 'Log type deleted.' });
  } catch (err) {
    console.error('DELETE /logtypes/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete log type.' });
  }
}

module.exports = { getAllLogTypes, createLogType, renameLogType, deleteLogType };
