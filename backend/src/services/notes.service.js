const Note = require('../models/Note');

function fmt(item) {
  return {
    _id:          item._id.toString(),
    content:      item.content,
    type:         item.type || 'regular',
    timestamp:    item.timestamp,
    logTypeId:    item.logTypeId    ?? null,
    logTypeName:  item.logTypeName  ?? null,
    domain:       item.domain       ?? null,
    logTypeColor: item.logTypeColor ?? null,
  };
}

async function getNotes(userId, date) {
  const doc = await Note.findOne({ userId, date });
  return { date, notes: doc ? doc.notes.map(fmt) : [] };
}

async function addNote(userId, date, { content = '', type = 'regular', logTypeId = null, logTypeName = null, domain = null, logTypeColor = null } = {}) {
  const doc = await Note.findOneAndUpdate(
    { userId, date },
    { $push: { notes: { content, type, timestamp: new Date(), logTypeId, logTypeName, domain, logTypeColor } } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return fmt(doc.notes[doc.notes.length - 1]);
}

async function updateTapperLogType(userId, date, noteId, { logTypeId, logTypeName, domain, logTypeColor }) {
  const doc = await Note.findOneAndUpdate(
    { userId, date, 'notes._id': noteId },
    {
      $set: {
        'notes.$.logTypeId':    logTypeId    ?? null,
        'notes.$.logTypeName':  logTypeName  ?? null,
        'notes.$.domain':       domain       ?? null,
        'notes.$.logTypeColor': logTypeColor ?? null,
      },
    },
    { new: true }
  );
  if (!doc) throw new Error('Note not found');
  return fmt(doc.notes.id(noteId));
}

async function updateNote(userId, date, noteId, content) {
  const doc = await Note.findOneAndUpdate(
    { userId, date, 'notes._id': noteId },
    { $set: { 'notes.$.content': content } },
    { new: true }
  );
  if (!doc) throw new Error('Note not found');
  return fmt(doc.notes.id(noteId));
}

async function deleteNote(userId, date, noteId) {
  const doc = await Note.findOneAndUpdate(
    { userId, date },
    { $pull: { notes: { _id: noteId } } },
    { new: true }
  );
  if (!doc) throw new Error('Note not found');
}

module.exports = { getNotes, addNote, updateNote, updateTapperLogType, deleteNote };
