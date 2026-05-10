const foodInsightsSvc = require('../services/food-insights.service');

async function getByLogId(req, res) {
  try {
    const insight = await foodInsightsSvc.getInsightByLogId(req.user.userId, req.params.logId);
    if (!insight) return res.status(404).json({ error: 'No insight found for this log.' });
    res.json(insight);
  } catch (err) {
    console.error('GET /food-insights/:logId error:', err.message);
    res.status(500).json({ error: 'Failed to fetch food insight.' });
  }
}

async function getByDate(req, res) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param is required.' });
    const insights = await foodInsightsSvc.getInsightsByDate(req.user.userId, date);
    res.json(insights);
  } catch (err) {
    console.error('GET /food-insights error:', err.message);
    res.status(500).json({ error: 'Failed to fetch food insights.' });
  }
}

async function generate(req, res) {
  try {
    const insight = await foodInsightsSvc.generateInsight(req.user.userId, req.params.logId);
    res.json(insight);
  } catch (err) {
    console.error('POST /food-insights/:logId/generate error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Failed to generate insight.' });
  }
}

module.exports = { getByLogId, getByDate, generate };
