const Season = require('../models/Season');

function fmt(doc) {
  return {
    _id:       doc._id.toString(),
    name:      doc.name,
    startDate: doc.startDate,
    createdAt: doc.createdAt,
  };
}

async function listSeasons(userId) {
  const docs = await Season.find({ userId }).sort({ startDate: -1 });
  return docs.map(fmt);
}

async function createSeason(userId, { name, startDate }) {
  const doc = await Season.create({ userId, name, startDate });
  return fmt(doc);
}

async function updateSeason(userId, seasonId, patch) {
  const allowed = {};
  if (patch.name      !== undefined) allowed.name      = patch.name;
  if (patch.startDate !== undefined) allowed.startDate = patch.startDate;
  const doc = await Season.findOneAndUpdate(
    { _id: seasonId, userId },
    { $set: allowed },
    { new: true }
  );
  if (!doc) throw new Error('Season not found');
  return fmt(doc);
}

async function deleteSeason(userId, seasonId) {
  const doc = await Season.findOneAndDelete({ _id: seasonId, userId });
  if (!doc) throw new Error('Season not found');
}

module.exports = { listSeasons, createSeason, updateSeason, deleteSeason };
