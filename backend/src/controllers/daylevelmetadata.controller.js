const service = require('../services/daylevelmetadata.service');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── GET /api/day-metadata/:date ─────────────────────────────────────────────
async function getMetadata(req, res) {
  try {
    const { date } = req.params;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    const data = await service.getOrCreateMetadata(req.user.userId, date);
    res.json(data);
  } catch (err) {
    console.error('GET /day-metadata/:date error:', err.message);
    res.status(500).json({ error: 'Failed to load day metadata.' });
  }
}

// ─── PUT /api/day-metadata/:date/day-type ─────────────────────────────────────
async function setDayType(req, res) {
  try {
    const { date } = req.params;
    const { dayType } = req.body;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format.' });
    const VALID = ['working', 'holiday', 'paid_leave', 'sick_leave', 'wfh'];
    if (!VALID.includes(dayType)) return res.status(400).json({ error: `dayType must be one of: ${VALID.join(', ')}.` });
    const data = await service.setDayType(req.user.userId, date, dayType);
    res.json(data);
  } catch (err) {
    console.error('PUT /day-metadata/:date/day-type error:', err.message);
    res.status(500).json({ error: 'Failed to set day type.' });
  }
}

// ─── POST /api/day-metadata/:date/capture ─────────────────────────────────────
async function capture(req, res) {
  try {
    const { date } = req.params;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date format.' });
    const data = await service.captureImportantLogs(req.user.userId, date);
    res.json(data);
  } catch (err) {
    console.error('POST /day-metadata/:date/capture error:', err.message);
    res.status(500).json({ error: 'Failed to capture important logs.' });
  }
}

// ─── GET /api/day-metadata/month/:year/:month ─────────────────────────────────
async function getMonthDayTypes(req, res) {
  try {
    const y = parseInt(req.params.year,  10);
    const m = parseInt(req.params.month, 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Invalid year or month.' });
    }
    const data = await service.getMonthDayTypes(req.user.userId, y, m);
    res.json(data);
  } catch (err) {
    console.error('GET /day-metadata/month error:', err.message);
    res.status(500).json({ error: 'Failed to load month day types.' });
  }
}

module.exports = { getMetadata, setDayType, capture, getMonthDayTypes };
