const Episode = require('../models/Episode');

function fmt(doc) {
  return {
    _id:          doc._id.toString(),
    date:         doc.date,
    seasonId:     doc.seasonId ? doc.seasonId.toString() : null,
    episodeName:  doc.episodeName,
    content:      doc.content,
    lastAccessAt: doc.lastAccessAt,
    createdAt:    doc.createdAt,
    updatedAt:    doc.updatedAt,
  };
}

async function getEpisode(userId, date) {
  const doc = await Episode.findOne({ userId, date });
  if (!doc) {
    return { date, seasonId: null, episodeName: '', content: '', lastAccessAt: null };
  }
  return fmt(doc);
}

async function upsertEpisode(userId, date, { episodeName, content, seasonId }) {
  const setFields = { lastAccessAt: new Date() };
  if (episodeName !== undefined) setFields.episodeName = episodeName;
  if (content     !== undefined) setFields.content     = content;
  if (seasonId    !== undefined) setFields.seasonId    = seasonId || null;

  const doc = await Episode.findOneAndUpdate(
    { userId, date },
    { $set: setFields },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return fmt(doc);
}

module.exports = { getEpisode, upsertEpisode };
