const https = require('https');
const configSvc    = require('./config.service');
const DefaultLogType = require('../models/DefaultLogType');
const LogType        = require('../models/LogType');

async function parseLogPrompt(userId, prompt, date) {
  const apiKey = await configSvc.getGeminiKey(userId);
  if (!apiKey) {
    const err = new Error('Gemini API key not configured. Go to Configurations to add your key.');
    err.status = 400;
    throw err;
  }

  const [defaultTypes, userTypes] = await Promise.all([
    DefaultLogType.find({ isActive: true }, 'name domain').lean(),
    LogType.find({ userId, isActive: true }, 'name domain').lean(),
  ]);

  const allTypes = [
    ...defaultTypes.map(t => ({ id: t._id.toString(), name: t.name, domain: t.domain })),
    ...userTypes.map(t => ({ id: t._id.toString(), name: t.name, domain: t.domain })),
  ];

  // Compact representation to keep prompt small
  const typesCompact = allTypes.map(t => `${t.id}|${t.name}|${t.domain}`).join('\n');

  const systemPrompt = `Time log parser. Return ONLY a compact JSON array, no markdown, no explanation.

Log types (format: id|name|domain):
${typesCompact}

Rules:
- One array element per activity mentioned.
- Match activity to closest log type name. Use the exact id from above.
- entryType: "point" = single time, "range" = start+end.
- Times in HH:MM 24h. Infer missing times logically from context.
- title: use specific detail from input (e.g. "Maggi with chicken", "Break with Phani and Rajiv"), not just the type name.
- Date context: ${date}.

Output schema (array, even for one item):
[{"logTypeId":"...","logTypeName":"...","domain":"...","entryType":"point|range","pointTime":"HH:MM or null","startTime":"HH:MM or null","endTime":"HH:MM or null","title":"..."}]

Input: "${prompt}"`;

  const responseText = await _callGemini(apiKey, systemPrompt);
  console.log('[Renni] raw Gemini response:', responseText);

  // Strip markdown code fences, then extract JSON array (or object fallback)
  const stripped = responseText.replace(/```(?:json)?/gi, '').trim();
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (!arrMatch && !objMatch) throw new Error('Could not parse AI response');

  let items;
  try {
    items = arrMatch ? JSON.parse(arrMatch[0]) : [JSON.parse(objMatch[0])];
    if (!Array.isArray(items)) items = [items];
  } catch {
    throw new Error('Invalid JSON from AI');
  }

  return items.map(parsed => {
    const matchedType =
      allTypes.find(t => t.id === parsed.logTypeId) ||
      allTypes.find(t => t.name.toLowerCase() === (parsed.logTypeName || '').toLowerCase()) ||
      allTypes.find(t => t.name.toLowerCase().includes((parsed.logTypeName || '').toLowerCase()));
    if (!matchedType) throw new Error(`Unrecognised log type: ${parsed.logTypeName}`);

    return {
      logTypeId:   matchedType.id,
      logTypeName: matchedType.name,
      domain:      matchedType.domain,
      entryType:   parsed.entryType === 'range' ? 'range' : 'point',
      pointTime:   parsed.pointTime  ?? null,
      startTime:   parsed.startTime  ?? null,
      endTime:     parsed.endTime    ?? null,
      title:       parsed.title      ?? matchedType.name,
    };
  });
}

function _callGemini(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.1 }
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-flash-latest:generateContent`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-goog-api-key': apiKey }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          try {
            const p = JSON.parse(data);
            reject(new Error(p.error?.message || 'Gemini API error'));
          } catch { reject(new Error('Gemini API error')); }
          return;
        }
        try {
          const p = JSON.parse(data);
          const text = p.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) reject(new Error('Empty response from Gemini'));
          else resolve(text);
        } catch { reject(new Error('Invalid response from Gemini')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { parseLogPrompt };
