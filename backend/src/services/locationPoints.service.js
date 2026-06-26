const LocationPoint = require('../models/LocationPoint');

async function list(userId) {
  return LocationPoint.find({ userId }).sort({ createdAt: -1 }).lean();
}

async function create(userId, { name, lat, lng }) {
  return LocationPoint.create({ userId, name, lat, lng });
}

async function remove(userId, id) {
  return LocationPoint.findOneAndDelete({ _id: id, userId });
}

module.exports = { list, create, remove };
