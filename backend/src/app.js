const express = require('express');
const cors = require('cors');
const path = require('path');
const logsRouter = require('./routes/logs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Static route to serve logs data directory
app.use('/data', express.static(path.join(__dirname, '../data')));

// API routes
app.use('/api/logs', logsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Renmito backend running on http://localhost:${PORT}`);
});

module.exports = app;
