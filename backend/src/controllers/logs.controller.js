const logsService = require('../services/logs.service');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── GET /api/logs/month/:year/:month ─────────────────────────────────────────
async function getMonthSummary(req, res) {
  try {
    const y = parseInt(req.params.year,  10);
    const m = parseInt(req.params.month, 10);

    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Invalid year or month.' });
    }

    const summary = await logsService.getMonthWorkSummary(req.user.userId, y, m);
    res.json(summary);
  } catch (err) {
    console.error('GET /logs/month error:', err.message);
    res.status(500).json({ error: 'Failed to fetch monthly summary.' });
  }
}

// ─── GET /api/logs/:date ──────────────────────────────────────────────────────
async function getLogsByDate(req, res) {
  try {
    const { date } = req.params;
    if (!DATE_REGEX.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const logs = await logsService.getLogsByDate(req.user.userId, date);
    res.json(logs);
  } catch (err) {
    console.error('GET /logs/:date error:', err.message);
    res.status(500).json({ error: 'Failed to fetch logs.' });
  }
}

// ─── POST /api/logs/:date ─────────────────────────────────────────────────────
async function createLog(req, res) {
  try {
    const { date } = req.params;
    if (!DATE_REGEX.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const { startTime, endTime, title, logTypeId, entryType, pointTime } = req.body;
    const isPoint = entryType === 'point';

    if (isPoint) {
      if (!pointTime || !title || !logTypeId) {
        return res.status(400).json({ error: 'Missing required fields: pointTime, title, logTypeId' });
      }
    } else {
      if (!startTime || !endTime || !title || !logTypeId) {
        return res.status(400).json({ error: 'Missing required fields: startTime, endTime, title, logTypeId' });
      }
    }

    const result = await logsService.createLog(req.user.userId, date, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.data);
  } catch (err) {
    console.error('POST /logs/:date error:', err.message);
    res.status(500).json({ error: 'Failed to create log.' });
  }
}

// ─── PUT /api/logs/:date/:id ──────────────────────────────────────────────────
async function updateLog(req, res) {
  try {
    const { date, id } = req.params;
    if (!DATE_REGEX.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const result = await logsService.updateLog(req.user.userId, date, id, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('PUT /logs/:date/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update log.' });
  }
}

// ─── DELETE /api/logs/:date/:id ───────────────────────────────────────────────
async function deleteLog(req, res) {
  try {
    const { date, id } = req.params;
    if (!DATE_REGEX.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const result = await logsService.deleteLog(req.user.userId, id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('DELETE /logs/:date/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete log.' });
  }
}

// ─── GET /api/logs/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD ─────────────
async function getLogsByDateRange(req, res) {
  try {
    const { startDate, endDate } = req.query;
    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ error: 'startDate must be on or before endDate.' });
    }
    const logs = await logsService.getLogsByDateRange(req.user.userId, startDate, endDate);
    res.json(logs);
  } catch (err) {
    console.error('GET /logs/range error:', err.message);
    res.status(500).json({ error: 'Failed to fetch logs.' });
  }
}

// ─── PATCH /api/logs/:id/report ───────────────────────────────────────────────
async function updateLogReport(req, res) {
  try {
    const { id } = req.params;
    const result = await logsService.updateLogReport(req.user.userId, id, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (err) {
    console.error('PATCH /logs/:id/report error:', err.message);
    res.status(500).json({ error: 'Failed to update log.' });
  }
}

module.exports = { getMonthSummary, getLogsByDate, createLog, updateLog, deleteLog, getLogsByDateRange, updateLogReport };
