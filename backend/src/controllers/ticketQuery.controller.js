const svc = require('../services/ticketQuery.service');

async function list(req, res) {
  try {
    const queries = await svc.listQueries(req.user.userId);
    res.json(queries);
  } catch (err) {
    console.error('GET /jira/queries error:', err.message);
    res.status(500).json({ error: 'Failed to load queries.' });
  }
}

async function create(req, res) {
  try {
    const { name, jql } = req.body;
    if (!name?.trim() || !jql?.trim()) {
      return res.status(400).json({ error: 'name and jql are required.' });
    }
    const query = await svc.verifyAndSaveQuery(req.user.userId, { name: name.trim(), jql: jql.trim() });
    res.status(201).json(query);
  } catch (err) {
    console.error('POST /jira/queries error:', err.message, err.body);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 401) return res.status(401).json({ error: 'Invalid JIRA credentials.' });
    res.status(502).json({ error: err.message || 'JQL verification failed.' });
  }
}

async function update(req, res) {
  try {
    const { name, jql } = req.body;
    if (!name?.trim() || !jql?.trim()) {
      return res.status(400).json({ error: 'name and jql are required.' });
    }
    const query = await svc.verifyAndUpdateQuery(req.user.userId, req.params.id, { name: name.trim(), jql: jql.trim() });
    res.json(query);
  } catch (err) {
    console.error('PUT /jira/queries/:id error:', err.message, err.body);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 401) return res.status(401).json({ error: 'Invalid JIRA credentials.' });
    res.status(502).json({ error: err.message || 'JQL verification failed.' });
  }
}

async function remove(req, res) {
  try {
    await svc.deleteQuery(req.user.userId, req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /jira/queries/:id error:', err.message);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to delete query.' });
  }
}

async function clone(req, res) {
  try {
    const query = await svc.cloneQuery(req.user.userId, req.params.id);
    res.status(201).json(query);
  } catch (err) {
    console.error('POST /jira/queries/:id/clone error:', err.message);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to clone query.' });
  }
}

module.exports = { list, create, update, remove, clone };
