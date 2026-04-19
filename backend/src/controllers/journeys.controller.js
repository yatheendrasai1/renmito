const svc = require('../services/journeys.service');

// ─── Journeys ─────────────────────────────────────────────────────────────────

async function listJourneys(req, res) {
  try {
    const journeys = await svc.listJourneys(req.user.userId);
    res.json(journeys);
  } catch (err) {
    console.error('GET /journeys error:', err.message);
    res.status(500).json({ error: 'Failed to fetch journeys.' });
  }
}

async function getJourney(req, res) {
  try {
    const result = await svc.getJourney(req.user.userId, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('GET /journeys/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch journey.' });
  }
}

async function createJourney(req, res) {
  try {
    const { name, startDate, span, trackerType } = req.body;
    if (!name || !startDate || !span || !trackerType) {
      return res.status(400).json({ error: 'Missing required fields: name, startDate, span, trackerType.' });
    }
    const result = await svc.createJourney(req.user.userId, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.data);
  } catch (err) {
    console.error('POST /journeys error:', err.message);
    res.status(500).json({ error: 'Failed to create journey.' });
  }
}

async function updateJourney(req, res) {
  try {
    const result = await svc.updateJourney(req.user.userId, req.params.id, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('PUT /journeys/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update journey.' });
  }
}

async function deleteJourney(req, res) {
  try {
    const result = await svc.deleteJourney(req.user.userId, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('DELETE /journeys/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete journey.' });
  }
}

// ─── Entries ──────────────────────────────────────────────────────────────────

async function listEntries(req, res) {
  try {
    const result = await svc.listEntries(req.user.userId, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('GET /journeys/:id/entries error:', err.message);
    res.status(500).json({ error: 'Failed to fetch entries.' });
  }
}

async function addEntry(req, res) {
  try {
    const { timestamp, valueType } = req.body;
    if (!timestamp || !valueType) {
      return res.status(400).json({ error: 'Missing required fields: timestamp, valueType.' });
    }
    const result = await svc.addEntry(req.user.userId, req.params.id, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.data);
  } catch (err) {
    console.error('POST /journeys/:id/entries error:', err.message);
    res.status(500).json({ error: 'Failed to add entry.' });
  }
}

async function updateEntry(req, res) {
  try {
    const result = await svc.updateEntry(req.user.userId, req.params.id, req.params.entryId, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('PUT /journeys/:id/entries/:entryId error:', err.message);
    res.status(500).json({ error: 'Failed to update entry.' });
  }
}

async function deleteEntry(req, res) {
  try {
    const result = await svc.deleteEntry(req.user.userId, req.params.id, req.params.entryId, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('DELETE /journeys/:id/entries/:entryId error:', err.message);
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
}

async function resyncJourney(req, res) {
  try {
    const result = await svc.resyncDerivedJourney(req.user.userId, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('POST /journeys/:id/resync error:', err.message);
    res.status(500).json({ error: 'Failed to resync journey.' });
  }
}

module.exports = {
  listJourneys, getJourney, createJourney, updateJourney, deleteJourney,
  listEntries, addEntry, updateEntry, deleteEntry, resyncJourney
};
