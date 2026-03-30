const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(date) {
  return path.join(DATA_DIR, `${date}.json`);
}

function readLogsForDate(date) {
  const filePath = getFilePath(date);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading file for date ${date}:`, err);
    return [];
  }
}

function writeLogsForDate(date, logs) {
  const filePath = getFilePath(date);
  fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf8');
}

// GET /api/logs/:date — get all logs for a date
router.get('/:date', (req, res) => {
  const { date } = req.params;
  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }
  const logs = readLogsForDate(date);
  res.json(logs);
});

// POST /api/logs/:date — create a new log entry
router.post('/:date', (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const { startTime, endTime, type, label, color } = req.body;

  if (!startTime || !endTime || !type || !label) {
    return res.status(400).json({ error: 'Missing required fields: startTime, endTime, type, label' });
  }

  const logs = readLogsForDate(date);

  const newEntry = {
    id: uuidv4(),
    date,
    startTime,
    endTime,
    type,
    label,
    color: color || '#9B9B9B'
  };

  logs.push(newEntry);
  writeLogsForDate(date, logs);

  res.status(201).json(newEntry);
});

// PUT /api/logs/:date/:id — update a log entry
router.put('/:date/:id', (req, res) => {
  const { date, id } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const logs = readLogsForDate(date);
  const index = logs.findIndex(log => log.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Log entry not found.' });
  }

  const { startTime, endTime, type, label, color } = req.body;

  logs[index] = {
    ...logs[index],
    ...(startTime !== undefined && { startTime }),
    ...(endTime !== undefined && { endTime }),
    ...(type !== undefined && { type }),
    ...(label !== undefined && { label }),
    ...(color !== undefined && { color })
  };

  writeLogsForDate(date, logs);
  res.json(logs[index]);
});

// DELETE /api/logs/:date/:id — delete a log entry
router.delete('/:date/:id', (req, res) => {
  const { date, id } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const logs = readLogsForDate(date);
  const index = logs.findIndex(log => log.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Log entry not found.' });
  }

  logs.splice(index, 1);
  writeLogsForDate(date, logs);
  res.json({ message: 'Log entry deleted successfully.' });
});

module.exports = router;
