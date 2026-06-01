const jiraService = require('../services/jira.service');

// ─── GET /api/jira/config ─────────────────────────────────────────────────────
async function getConfig(req, res) {
  try {
    const config = await jiraService.getJiraConfig(req.user.userId);
    if (!config) return res.status(204).end();
    res.json(config);
  } catch (err) {
    console.error('GET /jira/config error:', err.message);
    res.status(500).json({ error: 'Failed to load JIRA config.' });
  }
}

// ─── PUT /api/jira/config ─────────────────────────────────────────────────────
async function saveConfig(req, res) {
  try {
    const { baseUrl, email, apiToken } = req.body;
    if (!baseUrl || !email || !apiToken) {
      return res.status(400).json({ error: 'baseUrl, email, and apiToken are required.' });
    }
    const result = await jiraService.saveJiraConfig(req.user.userId, { baseUrl, email, apiToken });
    res.json(result);
  } catch (err) {
    console.error('PUT /jira/config error:', err.message);
    res.status(500).json({ error: 'Failed to save JIRA config.' });
  }
}

// ─── DELETE /api/jira/config ──────────────────────────────────────────────────
async function deleteConfig(req, res) {
  try {
    await jiraService.deleteJiraConfig(req.user.userId);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /jira/config error:', err.message);
    res.status(500).json({ error: 'Failed to remove JIRA config.' });
  }
}

// ─── POST /api/jira/test ──────────────────────────────────────────────────────
async function testConnection(req, res) {
  try {
    const result = await jiraService.testJiraConnection(req.user.userId);
    res.json(result);
  } catch (err) {
    console.error('POST /jira/test error:', err.message);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 401) return res.status(401).json({ error: 'Invalid JIRA credentials.' });
    res.status(502).json({ error: 'Could not reach JIRA. Check your base URL and token.' });
  }
}

// ─── POST /api/jira/search ────────────────────────────────────────────────────
async function searchTickets(req, res) {
  try {
    const { jql, maxResults } = req.body;
    if (!jql) return res.status(400).json({ error: 'jql is required.' });
    const results = await jiraService.searchJira(req.user.userId, { jql, maxResults });
    res.json(results);
  } catch (err) {
    console.error('POST /jira/search error:', err.message, err.body);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 401) return res.status(401).json({ error: 'Invalid JIRA credentials.' });
    if (err.status === 400) return res.status(400).json({ error: err.message || 'Invalid JQL query.' });
    res.status(502).json({ error: err.message || 'Could not reach JIRA. Check your base URL and token.' });
  }
}

module.exports = { getConfig, saveConfig, deleteConfig, testConnection, searchTickets };
