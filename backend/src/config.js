require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const config = {
  db: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    uri: `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.rhjsiol.mongodb.net/renmito?retryWrites=true&w=majority&appName=Cluster0`
  },
  auth: {
    jwtSecret:    process.env.JWT_SECRET,
    jwtExpiresIn: '7d',
    masterKey:    process.env.MASTER_KEY || null
  },
  server: {
    port: parseInt(process.env.PORT || '5890', 10)
  },
  cors: {
    // Local dev: http://localhost:4200
    // Vercel:    set CORS_ORIGIN=* in project environment variables
    // Mobile:    capacitor://localhost and https://localhost (Capacitor Android/iOS)
    // Supports comma-separated list: CORS_ORIGIN=http://localhost:4200,https://localhost
    origin: (() => {
      const raw = process.env.CORS_ORIGIN || 'http://localhost:4200,https://localhost,capacitor://localhost';
      if (raw === '*') return '*';
      const list = raw.split(',').map(o => o.trim()).filter(Boolean);
      return list.length === 1 ? list[0] : list;
    })()
  },
  ic: {
    serviceUrl:     process.env.IC_SERVICE_URL     || 'http://localhost:8000',
    internalSecret: process.env.IC_INTERNAL_SECRET || '',
  }
};

module.exports = config;
