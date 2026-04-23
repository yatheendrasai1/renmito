const https = require('https');
const configSvc    = require('./config.service');
const DefaultLogType = require('../models/DefaultLogType');
const LogType        = require('../models/LogType');
const TimeLog        = require('../models/TimeLog');

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

async function chatWithRenni(userId, message, date) {
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

  const typesCompact = allTypes.map(t => `${t.id}|${t.name}|${t.domain}`).join('\n');

  // Fetch today + yesterday logs for context
  const dateObj  = new Date(date);
  const prevDate = new Date(dateObj);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const logs = await TimeLog.find({
    userId,
    startAt: {
      $gte: new Date(`${prevDateStr}T00:00:00.000Z`),
      $lte: new Date(`${date}T23:59:59.999Z`),
    },
    status: { $ne: 'cancelled' },
  }).populate('logTypeId', 'name').sort({ startAt: 1 }).lean();

  const formatLog = log => {
    const typeName = log.logTypeId?.name || log.title;
    const logDate  = log.startAt.toISOString().split('T')[0];
    const label    = logDate === date ? 'today' : 'yesterday';
    if (log.entryType === 'point') {
      const t = log.startAt.toISOString().slice(11, 16);
      return `[${label}] ${typeName}: "${log.title}" at ${t}`;
    } else {
      const s = log.startAt.toISOString().slice(11, 16);
      const e = log.endAt ? log.endAt.toISOString().slice(11, 16) : 'ongoing';
      return `[${label}] ${typeName}: "${log.title}" ${s}–${e}`;
    }
  };

  const logsContext = logs.length > 0 ? logs.map(formatLog).join('\n') : 'No logs recorded yet.';

  const systemPrompt = `You are Renni, a friendly AI assistant inside Renmito time tracker.

Today's date: ${date}
User's recent logs:
${logsContext}

Available log types (id|name|domain):
${typesCompact}

Rules:
- If user describes activities to log, return type "logs".
- If user asks a question about their time or logs, return type "answer" with a short friendly text.
- For greetings or general chat, return type "answer".
- Times in HH:MM 24h. title: use specific detail from input.
- Be concise and warm in answers (1-2 sentences max).

Return ONLY valid JSON, no markdown, no explanation:

For logging: {"type":"logs","logs":[{"logTypeId":"...","logTypeName":"...","domain":"...","entryType":"point|range","pointTime":"HH:MM or null","startTime":"HH:MM or null","endTime":"HH:MM or null","title":"..."}]}

For answering: {"type":"answer","text":"..."}

User message: "${message}"`;

  const responseText = await _callGemini(apiKey, systemPrompt);
  console.log('[Renni chat] raw response:', responseText);

  const stripped = responseText.replace(/```(?:json)?/gi, '').trim();
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (!objMatch) throw new Error('Could not parse AI response');

  let result;
  try { result = JSON.parse(objMatch[0]); }
  catch { throw new Error('Invalid JSON from AI'); }

  if (result.type === 'logs') {
    const items = Array.isArray(result.logs) ? result.logs : [result.logs];
    result.logs = items.map(parsed => {
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

  return result;
}

module.exports = { parseLogPrompt, chatWithRenni };
