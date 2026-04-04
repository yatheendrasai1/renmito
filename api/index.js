/**
 * Vercel serverless function entry point.
 * Exports the Express app so Vercel can invoke it as a handler.
 * All /api/* requests are routed here via vercel.json rewrites.
 */
const app = require('../backend/src/app');
module.exports = app;
