const config               = require('./config');
const express              = require('express');
const cors                 = require('cors');
const mongoose             = require('mongoose');
const logsRouter           = require('./routes/logs');
const authRouter           = require('./routes/auth');
const logTypesRouter       = require('./routes/logtypes');
const enhancementsRouter   = require('./routes/enhancements');
const preferencesRouter    = require('./routes/preferences');
const authMiddleware       = require('./middleware/authMiddleware');
const seedDefaultLogTypes  = require('./utils/seedDefaults');
const seedEnhancements     = require('./utils/seedEnhancements');

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:         config.cors.origin,
  methods:        ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ── Lazy MongoDB connection (serverless-safe) ─────────────────────────────────
let _connectionPromise = null;

async function ensureConnection() {
  if (mongoose.connection.readyState === 1) return;
  if (!_connectionPromise) {
    _connectionPromise = mongoose
      .connect(config.db.uri)
      .then(async () => {
        console.log('Connected to MongoDB Atlas');
        await seedDefaultLogTypes();
        await seedEnhancements();
      })
      .catch(err => {
        _connectionPromise = null;
        throw err;
      });
  }
  return _connectionPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureConnection();
    next();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRouter);
app.use('/api/logs',         authMiddleware, logsRouter);
app.use('/api/logtypes',     authMiddleware, logTypesRouter);
app.use('/api/enhancements', authMiddleware, enhancementsRouter);
app.use('/api/preferences',  authMiddleware, preferencesRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Local dev server ──────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = config.server.port;
  app.listen(PORT, () => {
    console.log(`Renmito backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
