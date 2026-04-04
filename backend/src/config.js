require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const config = {
  db: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    uri: `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.rhjsiol.mongodb.net/renmito?retryWrites=true&w=majority&appName=Cluster0`
  },
  auth: {
    jwtSecret:    process.env.JWT_SECRET,
    jwtExpiresIn: '7d'
  },
  server: {
    port: parseInt(process.env.PORT || '5890', 10)
  }
};

module.exports = config;
