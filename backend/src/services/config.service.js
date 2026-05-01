const https = require('https');
const AccountConfig = require('../models/AccountConfig');

async function getConfig(userId) {
  const doc = await AccountConfig.findOne({ userId }).lean();
  if (!doc) return { geminiConfigured: false };
  return { geminiConfigured: doc.geminiVerified && !!doc.geminiApiKey };
}

async function verifyAndSaveGeminiKey(userId, apiKey) {
  console.log(`[Config] verifying Gemini key for user ...${userId.toString().slice(-6)}`);
  const t0 = Date.now();
  await _verifyGeminiKey(apiKey);
  console.log(`[Config] key verified ok in ${Date.now() - t0}ms`);
  await AccountConfig.findOneAndUpdate(
    { userId },
    { $set: { geminiApiKey: apiKey, geminiVerified: true } },
    { upsert: true, new: true }
  );
}

async function getGeminiKey(userId) {
  const doc = await AccountConfig.findOne({ userId }, 'geminiApiKey geminiVerified').lean();
  if (!doc?.geminiVerified || !doc?.geminiApiKey) return null;
  return doc.geminiApiKey;
}

function _verifyGeminiKey(apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: 'Hi' }] }],
      generationConfig: { maxOutputTokens: 1 }
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash-lite:generateContent`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-goog-api-key': apiKey }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) return resolve();
        try {
          const parsed = JSON.parse(data);
          const msg = parsed.error?.message || 'Invalid API key';
          console.error(`[Config] key verification failed (${res.statusCode}): ${msg}`);
          reject(new Error(msg));
        } catch {
          console.error(`[Config] key verification failed (${res.statusCode}): unparseable response`);
          reject(new Error('Invalid API key'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { getConfig, verifyAndSaveGeminiKey, getGeminiKey };
