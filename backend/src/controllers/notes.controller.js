const service = require('../services/notes.service');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getNotes(req, res) {
  try {
    const { date } = req.params;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format' });
    res.json(await service.getNotes(req.user.userId, date));
  } catch (err) {
    console.error('notes.getNotes:', err.message);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
}

async function addNote(req, res) {
  try {
    const { date } = req.params;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format' });
    res.json(await service.addNote(req.user.userId, date));
  } catch (err) {
    console.error('notes.addNote:', err.message);
    res.status(500).json({ error: 'Failed to add note' });
  }
}

async function updateNote(req, res) {
  try {
    const { date, noteId } = req.params;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format' });
    const { content = '' } = req.body;
    if (content.length > 500) return res.status(400).json({ error: 'Note exceeds 500 characters' });
    res.json(await service.updateNote(req.user.userId, date, noteId, content));
  } catch (err) {
    console.error('notes.updateNote:', err.message);
    res.status(500).json({ error: 'Failed to update note' });
  }
}

async function deleteNote(req, res) {
  try {
    const { date, noteId } = req.params;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format' });
    await service.deleteNote(req.user.userId, date, noteId);
    res.json({ ok: true });
  } catch (err) {
    console.error('notes.deleteNote:', err.message);
    res.status(500).json({ error: 'Failed to delete note' });
  }
}

module.exports = { getNotes, addNote, updateNote, deleteNote };
