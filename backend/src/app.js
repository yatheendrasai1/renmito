const config              = require('./config');
const express             = require('express');
const cors                = require('cors');
const mongoose            = require('mongoose');
const logsRouter          = require('./routes/logs');
const authRouter          = require('./routes/auth');
const logTypesRouter      = require('./routes/logtypes');
const authMiddleware      = require('./middleware/authMiddleware');
const seedDefaultLogTypes = require('./utils/seedDefaults');

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
// In production the frontend and backend share the same Vercel domain so
// same-origin requests need no CORS headers. Set CORS_ORIGIN=* in Vercel env
// vars to allow all origins (covers preview deployments).
// Locally, defaults to http://localhost:4200.
app.use(cors({
  origin:       config.cors.origin,
  methods:      ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ── Lazy MongoDB connection (serverless-safe) ─────────────────────────────────
// Vercel serverless containers may be cold-started at any time. Connecting
// lazily (on the first request) and caching the promise across warm invocations
// avoids both the startup-time cost and connection leaks.
let _connectionPromise = null;

async function ensureConnection() {
  // Already connected — fast-path
  if (mongoose.connection.readyState === 1) return;

  // Re-use in-flight promise (multiple concurrent cold-start requests)
  if (!_connectionPromise) {
    _connectionPromise = mongoose
      .connect(config.db.uri)
      .then(async () => {
        console.log('Connected to MongoDB Atlas');
        await seedDefaultLogTypes();
      })
      .catch(err => {
        _connectionPromise = null; // allow retry on next request
        throw err;
      });
  }
  return _connectionPromise;
}

// Ensure the DB is ready before every request
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

// Public — no auth required
app.use('/api/auth', authRouter);

// Protected — valid JWT required
app.use('/api/logs',     authMiddleware, logsRouter);
app.use('/api/logtypes', authMiddleware, logTypesRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Local dev server ──────────────────────────────────────────────────────────
// On Vercel, VERCEL=1 is injected automatically — skip app.listen() there.
if (!process.env.VERCEL) {
  const PORT = config.server.port;
  app.listen(PORT, () => {
    console.log(`Renmito backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
