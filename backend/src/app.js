const config             = require('./config');
const express            = require('express');
const cors               = require('cors');
const mongoose           = require('mongoose');
const logsRouter         = require('./routes/logs');
const authRouter         = require('./routes/auth');
const logTypesRouter     = require('./routes/logtypes');
const authMiddleware     = require('./middleware/authMiddleware');
const seedDefaultLogTypes = require('./utils/seedDefaults');

const app  = express();
const PORT = config.server.port;
mongoose.connect(config.db.uri)
  .then(async () => {
    console.log('Connected to MongoDB Atlas');
    await seedDefaultLogTypes();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Middleware
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Public routes — no auth required
app.use('/api/auth', authRouter);

// Protected routes — valid JWT required
app.use('/api/logs',     authMiddleware, logsRouter);
app.use('/api/logtypes', authMiddleware, logTypesRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Renmito backend running on http://localhost:${PORT}`);
});

module.exports = app;
