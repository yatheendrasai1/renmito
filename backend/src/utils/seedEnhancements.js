const path        = require('path');
const Enhancement = require('../models/Enhancement');

/**
 * Upserts every enhancement from enhancements.json into the "enhancements"
 * collection. Uses $setOnInsert so existing documents are never overwritten —
 * new entries added to the JSON file are automatically picked up on the next
 * server start.
 */
async function seedEnhancements() {
  try {
    const data = require(
      path.resolve(__dirname, '../../../frontend/src/assets/enhancements.json')
    );
    const list = (data.enhancements || []).filter(e => e.id && e.version && e.type && e.title);

    if (list.length === 0) return;

    const ops = list.map(e => ({
      updateOne: {
        filter: { id: e.id },
        update: {
          $setOnInsert: {
            id:            e.id,
            version:       e.version,
            type:          e.type,
            title:         e.title,
            description:   e.description  || '',
            status:        e.status       || 'implemented',
            implementedAt: e.implementedAt ? new Date(e.implementedAt) : null,
            tags:          e.tags         || [],
            relatedTo:     e.relatedTo    || [],
            requestedBy:   e.requestedBy  || 'owner',
            breaking:      e.breaking     || false,
            notes:         e.notes        || ''
          }
        },
        upsert: true
      }
    }));

    await Enhancement.bulkWrite(ops);
    console.log(`Enhancement seed: ${list.length} entries synced.`);
  } catch (err) {
    console.error('Enhancement seed error:', err.message);
  }
}

module.exports = seedEnhancements;
