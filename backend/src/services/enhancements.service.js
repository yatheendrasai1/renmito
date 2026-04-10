const Enhancement = require('../models/Enhancement');

/**
 * Returns all enhancements sorted by version id ascending.
 */
async function listEnhancements() {
  return Enhancement.find({}).sort({ id: 1 }).lean();
}

/**
 * Creates a new enhancement entry.
 * Returns { data, status } or { error, status }.
 */
async function createEnhancement(fields) {
  const { id, version, type, title, description, status,
          implementedAt, tags, relatedTo, requestedBy, breaking, notes } = fields;

  const exists = await Enhancement.findOne({ id }).lean();
  if (exists) return { error: `Enhancement ${id} already exists.`, status: 409 };

  const doc = await Enhancement.create({
    id, version, type, title,
    description:   description   ?? '',
    status:        status        ?? 'implemented',
    implementedAt: implementedAt ? new Date(implementedAt) : null,
    tags:          tags          ?? [],
    relatedTo:     relatedTo     ?? [],
    requestedBy:   requestedBy   ?? 'owner',
    breaking:      breaking      ?? false,
    notes:         notes         ?? ''
  });

  return { data: doc, status: 201 };
}

module.exports = { listEnhancements, createEnhancement };
