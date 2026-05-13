const Season = require('../models/Season');

const SEASON_COLORS = ['#f4845f', '#7c6cf5', '#4ade80', '#f59e0b', '#60a5fa', '#f472b6', '#34d399', '#fb923c'];

function randomColor() {
  return SEASON_COLORS[Math.floor(Math.random() * SEASON_COLORS.length)];
}

function fmt(doc) {
  return {
    _id:       doc._id.toString(),
    name:      doc.name,
    startDate: doc.startDate,
    color:     doc.color || '#f4845f',
    createdAt: doc.createdAt,
  };
}

async function listSeasons(userId) {
  const docs = await Season.find({ userId }).sort({ startDate: -1 });
  return docs.map(fmt);
}

async function createSeason(userId, { name, startDate, color }) {
  const doc = await Season.create({ userId, name, startDate, color: color || randomColor() });
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
