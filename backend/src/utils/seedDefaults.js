const DefaultLogType = require('../models/DefaultLogType');
const defaultLogTypes = require('../data/defaultLogTypes.json');

/**
 * Seeds the "defaultlogtypes" collection from defaultLogTypes.json.
 * Runs only when the collection is empty — safe to call on every startup.
 */
async function seedDefaultLogTypes() {
  const count = await DefaultLogType.countDocuments();
  if (count > 0) return; // already seeded

  await DefaultLogType.insertMany(defaultLogTypes);
  console.log(`Seeded ${defaultLogTypes.length} default log types into defaultlogtypes collection`);
}

module.exports = seedDefaultLogTypes;
