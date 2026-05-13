const Episode = require('../models/Episode');

function fmt(doc, dayNumber) {
  return {
    _id:              doc._id.toString(),
    date:             doc.date,
    seasonId:         doc.seasonId ? doc.seasonId.toString() : null,
    episodeName:      doc.episodeName,
    content:          doc.content,
    sentiment:        { label: doc.sentiment?.label || '', emoji: doc.sentiment?.emoji || '' },
    startedWritingAt: doc.startedWritingAt ?? null,
    dayNumber:        dayNumber ?? 1,
    lastAccessAt:     doc.lastAccessAt,
    createdAt:        doc.createdAt,
    updatedAt:        doc.updatedAt,
  };
}

async function getDayNumber(userId, date) {
  const first = await Episode.findOne({ userId }, 'date').sort({ date: 1 });
  if (!first) return 1;
  const d1 = new Date(first.date);
  const d2 = new Date(date);
  return Math.max(1, Math.floor((d2 - d1) / 86400000) + 1);
}

async function getEpisode(userId, date) {
  const doc = await Episode.findOne({ userId, date });
  if (!doc) {
    return { date, seasonId: null, episodeName: '', content: '', sentiment: { label: '', emoji: '' }, startedWritingAt: null, dayNumber: 1, lastAccessAt: null };
  }
  const dayNumber = await getDayNumber(userId, date);
  return fmt(doc, dayNumber);
}

async function upsertEpisode(userId, date, { episodeName, content, seasonId, sentiment }) {
  const setFields = { lastAccessAt: new Date() };
  if (episodeName !== undefined) setFields.episodeName = episodeName;
  if (content     !== undefined) setFields.content     = content;
  if (seasonId    !== undefined) setFields.seasonId    = seasonId || null;
  if (sentiment   !== undefined) {
    setFields['sentiment.label'] = sentiment.label || '';
    setFields['sentiment.emoji'] = sentiment.emoji || '';
  }

  const doc = await Episode.findOneAndUpdate(
    { userId, date },
    {
      $set:         setFields,
      $setOnInsert: { startedWritingAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const dayNumber = await getDayNumber(userId, date);
  return fmt(doc, dayNumber);
}

async function deleteEpisode(userId, date) {
  const doc = await Episode.findOneAndDelete({ userId, date });
  return { deleted: !!doc };
}

module.exports = { getEpisode, upsertEpisode, deleteEpisode };
