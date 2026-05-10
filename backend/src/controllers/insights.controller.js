const service = require('../services/insights.service');

async function getAll(req, res) {
  try {
    res.json(await service.getAll(req.user.userId));
  } catch (err) {
    console.error('insights.getAll:', err.message);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
}

async function getById(req, res) {
  try {
    res.json(await service.getById(req.user.userId, req.params.insightId));
  } catch (err) {
    if (err.message === 'Not found') return res.status(404).json({ error: 'Insight not found' });
    console.error('insights.getById:', err.message);
    res.status(500).json({ error: 'Failed to fetch insight' });
  }
}

async function createInsight(req, res) {
  try {
    const { label, name, model, type, promptId } = req.body || {};
    if (!label || !name) return res.status(400).json({ error: 'label and name are required' });
    const result = await service.createUserInsight(req.user.userId, { label, name, model, type, promptId });
    res.status(201).json(result);
  } catch (err) {
    console.error('insights.createInsight:', err.message);
    res.status(500).json({ error: 'Failed to create insight' });
  }
}

async function updateInsight(req, res) {
  try {
    const { type, model, promptId, enabled } = req.body || {};
    const result = await service.updateInsight(req.user.userId, req.params.insightId, { type, model, promptId, enabled });
    res.json(result);
  } catch (err) {
    if (err.message === 'Not found') return res.status(404).json({ error: 'Insight not found' });
    console.error('insights.updateInsight:', err.message);
    res.status(500).json({ error: 'Failed to update insight' });
  }
}

async function analyzeInsight(req, res) {
  try {
    const { period, startDate, endDate } = req.body || {};
    const validPeriods = ['today', 'yesterday', 'last7days', 'custom'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: 'period must be: today | yesterday | last7days | custom' });
    }
    if (period === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({ error: 'startDate and endDate are required for custom period' });
    }
    const result = await service.analyzeInsight(req.user.userId, req.params.insightId, period, startDate, endDate);
    res.json(result);
  } catch (err) {
    if (err.message === 'Not found') return res.status(404).json({ error: 'Insight not found' });
    const status = err.status || 500;
    console.error('insights.analyzeInsight:', err.message);
    res.status(status).json({ error: err.message, code: err.code || 'UNKNOWN' });
  }
}

module.exports = { getAll, getById, createInsight, updateInsight, analyzeInsight };
