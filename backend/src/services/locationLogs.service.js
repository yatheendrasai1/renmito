const LocationLog = require('../models/LocationLog');

async function bulkInsert(userId, coordinates) {
  const doc = new LocationLog({ userId, coordinates });
  await doc.save();
  return doc;
}

async function getByUser(userId, limit = 500) {
  return LocationLog.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = { bulkInsert, getByUser };
