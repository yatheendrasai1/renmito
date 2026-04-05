const DefaultLogType = require('../models/DefaultLogType');
const defaultLogTypes = require('../data/defaultLogTypes.json');

/**
 * Upserts all default log types from defaultLogTypes.json by name.
 * Safe to call on every startup — adds missing entries and updates
 * existing ones (e.g. domain changes like Transit work→personal).
 */
async function seedDefaultLogTypes() {
  for (const lt of defaultLogTypes) {
    await DefaultLogType.updateOne(
      { name: lt.name },
      { $set: lt },
      { upsert: true }
    );
  }
  console.log(`Upserted ${defaultLogTypes.length} default log types`);
}

module.exports = seedDefaultLogTypes;
