const DefaultLogType = require('../models/DefaultLogType');
const defaultLogTypes = require('../data/defaultLogTypes.json');

/**
 * Upserts all default log types from defaultLogTypes.json by name.
 * Safe to call on every startup — adds missing entries and updates
 * existing ones (e.g. domain changes like Transit work→personal).
 *
 * Pre-seed migrations run first to rename/reclassify existing docs
 * in-place, preserving their _id so existing TimeLog refs stay valid.
 */
async function seedDefaultLogTypes() {
  // ── 1.59 migrations ──────────────────────────────────────────────
  // Rename "Zleep" → "Sleep" in-place (preserves _id; fixes typo)
  await DefaultLogType.updateOne(
    { name: 'Zleep', category: 'sleep' },
    { $set: { name: 'Sleep' } }
  );
  // Merge "Family Time" from domain 'family' → 'personal' in-place
  await DefaultLogType.updateOne(
    { name: 'Family Time', domain: 'family' },
    { $set: { domain: 'personal' } }
  );

  // ── Main upsert loop ─────────────────────────────────────────────
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
