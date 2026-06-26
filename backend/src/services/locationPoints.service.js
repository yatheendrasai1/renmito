const LocationPoint = require('../models/LocationPoint');

async function list(userId) {
  return LocationPoint.find({ userId }).sort({ createdAt: -1 }).lean();
}

async function create(userId, { name, lat, lng, radius }) {
  return LocationPoint.create({ userId, name, lat, lng, radius });
}

async function update(userId, id, { name, radius }) {
  const patch = {};
  if (name !== undefined) patch.name = name.trim();
  if (radius !== undefined) patch.radius = radius;
  return LocationPoint.findOneAndUpdate(
    { _id: id, userId },
    { $set: patch },
    { new: true, runValidators: true }
  );
}

async function remove(userId, id) {
  return LocationPoint.findOneAndDelete({ _id: id, userId });
}

module.exports = { list, create, update, remove };
