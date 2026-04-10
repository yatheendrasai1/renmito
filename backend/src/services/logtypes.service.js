const LogType        = require('../models/LogType');
const DefaultLogType = require('../models/DefaultLogType');

const SORT = { domain: 1, category: 1, name: 1 };

/**
 * Returns the merged list of default + user-scoped log types.
 */
async function getAllLogTypes(userId) {
  const [defaults, userTypes] = await Promise.all([
    DefaultLogType.find({ isActive: true }).sort(SORT).lean(),
    LogType.find({ userId, isActive: true }).sort(SORT).lean()
  ]);

  return [
    ...defaults.map(lt  => ({ ...lt, source: 'default' })),
    ...userTypes.map(lt => ({ ...lt, source: 'user' }))
  ];
}

/**
 * Creates a new log type scoped to the authenticated user.
 */
async function createLogType(userId, { name, domain, category, color, icon }) {
  const logType = await LogType.create({
    userId,
    name,
    domain,
    category:  category || '',
    color:     color    || '#9B9B9B',
    icon:      icon     || '',
    isBuiltIn: false,
    isActive:  true
  });

  return { ...logType.toObject(), source: 'user' };
}

/**
 * Renames a user-owned log type (name field only).
 * Returns the updated doc or null if not found.
 */
async function renameLogType(userId, id, name) {
  const logType = await LogType.findOneAndUpdate(
    { _id: id, userId },
    { $set: { name: name.trim() } },
    { new: true }
  );

  if (!logType) return null;
  return { ...logType.toObject(), source: 'user' };
}

/**
 * Soft-deletes a user-owned log type (preserves _id so existing log refs stay valid).
 * Returns true if deleted, false if not found.
 */
async function softDeleteLogType(userId, id) {
  const logType = await LogType.findOneAndUpdate(
    { _id: id, userId },
    { $set: { isActive: false } }
  );

  return !!logType;
}

module.exports = {
  getAllLogTypes,
  createLogType,
  renameLogType,
  softDeleteLogType
};
