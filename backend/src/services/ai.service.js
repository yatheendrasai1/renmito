const https = require('https');
const configSvc    = require('./config.service');
const DefaultLogType = require('../models/DefaultLogType');
const LogType        = require('../models/LogType');
const TimeLog        = require('../models/TimeLog');

// ── Structured logger ──────────────────────────────────────────────────────
function aiLog(level, op, msg, extra) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 23);
  const tag = level === 'error' ? '[AI ERROR]' : level === 'warn' ? '[AI WARN]' : '[AI]';
  const extraStr = extra ? ' ' + JSON.stringify(extra) : '';
  const line = `${tag} ${ts} [${op}] ${msg}${extraStr}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

async function parseLogPrompt(userId, prompt, date) {
  const op = 'parseLog';
  aiLog('info', op, 'start', { userId: userId.toString().slice(-6), promptLen: prompt.length, date });

  const apiKey = await configSvc.getGeminiKey(userId);
  if (!apiKey) {
    aiLog('warn', op, 'no API key configured');
    const err = new Error('Gemini API key not configured. Go to Configurations to add your key.');
    err.status = 400;
    err.code   = 'NO_API_KEY';
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

  aiLog('info', op, 'log types loaded', { defaultCount: defaultTypes.length, userCount: userTypes.length });

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

  const t0 = Date.now();
  const { text: responseText, finishReason } = await _callGemini(apiKey, systemPrompt, op);
  aiLog('info', op, 'gemini responded', { latencyMs: Date.now() - t0, finishReason, responseLen: responseText.length });
  aiLog('info', op, 'raw response', { text: responseText.slice(0, 300) });

  // Strip markdown code fences, then extract JSON array (or object fallback)
  const stripped = responseText.replace(/```(?:json)?/gi, '').trim();
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (!arrMatch && !objMatch) {
    aiLog('error', op, 'no JSON found in response', { finishReason, raw: responseText.slice(0, 200) });
    const msg = finishReason === 'MAX_TOKENS'
      ? 'The AI response was too long and got cut off. Try logging fewer activities at once.'
      : 'AI returned an unrecognisable response. Please try again.';
    const err = new Error(msg);
    err.status = 502;
    err.code   = 'PARSE_ERROR';
    throw err;
  }

  let items;
  try {
    items = arrMatch ? JSON.parse(arrMatch[0]) : [JSON.parse(objMatch[0])];
    if (!Array.isArray(items)) items = [items];
  } catch (e) {
    aiLog('warn', op, 'JSON parse failed, attempting repair', { finishReason, parseError: e.message });
    const raw = (arrMatch || objMatch)[0];
    const repaired = _repairTruncatedJson(raw);
    if (repaired) {
      items = Array.isArray(repaired) ? repaired : [repaired];
      aiLog('info', op, 'repaired truncated JSON', { itemCount: items.length });
    } else {
      aiLog('error', op, 'JSON repair failed', { finishReason });
      const msg = finishReason === 'MAX_TOKENS'
        ? 'The AI response was cut off. Try logging fewer activities at once.'
        : 'AI returned invalid JSON. Please try again.';
      const err = new Error(msg);
      err.status = 502;
      err.code   = 'PARSE_ERROR';
      throw err;
    }
  }

  aiLog('info', op, 'parsed items', { count: items.length });

  const result = items.map(parsed => {
    const matchedType =
      allTypes.find(t => t.id === parsed.logTypeId) ||
      allTypes.find(t => t.name.toLowerCase() === (parsed.logTypeName || '').toLowerCase()) ||
      allTypes.find(t => t.name.toLowerCase().includes((parsed.logTypeName || '').toLowerCase()));
    if (!matchedType) {
      aiLog('warn', op, 'unrecognised log type', { logTypeName: parsed.logTypeName });
      const err = new Error(`Unrecognised log type: "${parsed.logTypeName}". Try rephrasing your input.`);
      err.status = 422;
      err.code   = 'UNRECOGNISED_TYPE';
      throw err;
    }

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

  aiLog('info', op, 'done', { resultCount: result.length });
  return result;
}

function _callGemini(apiKey, prompt, callerOp) {
  const op = callerOp || 'gemini';
  aiLog('info', op, 'calling Gemini', { model: 'gemini-2.5-flash-lite', promptLen: prompt.length });

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.1 }
    });
    const t0 = Date.now();
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash-lite:generateContent`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-goog-api-key': apiKey }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latencyMs = Date.now() - t0;
        if (res.statusCode !== 200) {
          let apiErrMsg = 'Gemini API error';
          try {
            const p = JSON.parse(data);
            apiErrMsg = p.error?.message || apiErrMsg;
          } catch { /* ignore */ }
          aiLog('error', op, 'Gemini HTTP error', { status: res.statusCode, latencyMs, message: apiErrMsg });
          const err = new Error(apiErrMsg);
          err.status = res.statusCode === 429 ? 429 : 502;
          err.code   = 'GEMINI_API_ERROR';
          reject(err);
          return;
        }
        try {
          const p = JSON.parse(data);
          const candidate   = p.candidates?.[0];
          const text        = candidate?.content?.parts?.[0]?.text;
          const finishReason = candidate?.finishReason || 'UNKNOWN';
          const tokenCount  = p.usageMetadata?.candidatesTokenCount;

          aiLog('info', op, 'Gemini response', { latencyMs, finishReason, tokenCount, responseLen: text?.length ?? 0 });

          if (finishReason === 'MAX_TOKENS') {
            aiLog('warn', op, 'response truncated by MAX_TOKENS', { tokenCount, partialText: text?.slice(0, 100) });
          }

          if (!text) {
            aiLog('warn', op, 'Gemini returned empty candidate', { latencyMs, finishReason, raw: data.slice(0, 200) });
            const err = new Error('Gemini returned an empty response.');
            err.status = 502;
            err.code   = 'EMPTY_RESPONSE';
            reject(err);
          } else {
            resolve({ text, finishReason });
          }
        } catch (e) {
          aiLog('error', op, 'failed to parse Gemini response body', { latencyMs, parseError: e.message });
          const err = new Error('Invalid response from Gemini.');
          err.status = 502;
          err.code   = 'PARSE_ERROR';
          reject(err);
        }
      });
    });
    req.on('error', (e) => {
      aiLog('error', op, 'network error reaching Gemini', { message: e.message });
      const err = new Error('Could not reach Gemini API. Check your network.');
      err.status = 503;
      err.code   = 'NETWORK_ERROR';
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

// Best-effort repair of JSON truncated mid-stream (MAX_TOKENS cut-off).
// Finds the last fully-closed top-level element and closes open containers.
function _repairTruncatedJson(raw) {
  // Walk char-by-char tracking string context so we don't count brackets inside strings.
  let inStr = false, esc = false, depth = 0, lastSafeEnd = -1;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (esc)           { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"')     { inStr = !inStr; continue; }
    if (inStr)         continue;
    if (c === '{' || c === '[') { depth++; }
    else if (c === '}' || c === ']') {
      depth--;
      // Any close while still inside a container is a potentially safe cut point
      if (depth >= 1) lastSafeEnd = i;
      // depth 0 means we closed the root — whole thing is valid
      if (depth === 0) { lastSafeEnd = i; break; }
    }
  }

  if (lastSafeEnd === -1) return null;

  const sliced = raw.slice(0, lastSafeEnd + 1);

  // Re-count unclosed containers in the sliced string
  inStr = false; esc = false;
  let ob = 0, cb = 0, oa = 0, ca = 0;
  for (const c of sliced) {
    if (esc)           { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"')     { inStr = !inStr; continue; }
    if (inStr)         continue;
    if (c === '{') ob++; else if (c === '}') cb++;
    if (c === '[') oa++; else if (c === ']') ca++;
  }

  let repaired = sliced;
  for (let i = 0; i < oa - ca; i++) repaired += ']';
  for (let i = 0; i < ob - cb; i++) repaired += '}';

  try { return JSON.parse(repaired); }
  catch { return null; }
}

async function chatWithRenni(userId, message, date) {
  const op = 'chat';
  aiLog('info', op, 'start', { userId: userId.toString().slice(-6), msgLen: message.length, date });

  const apiKey = await configSvc.getGeminiKey(userId);
  if (!apiKey) {
    aiLog('warn', op, 'no API key configured');
    const err = new Error('Gemini API key not configured. Go to Configurations to add your key.');
    err.status = 400;
    err.code   = 'NO_API_KEY';
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

  aiLog('info', op, 'context loaded', { logsInContext: logs.length });

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

  const t0 = Date.now();
  const { text: responseText, finishReason } = await _callGemini(apiKey, systemPrompt, op);
  aiLog('info', op, 'gemini responded', { latencyMs: Date.now() - t0, finishReason, responseLen: responseText.length });
  aiLog('info', op, 'raw response', { text: responseText.slice(0, 300) });

  const stripped = responseText.replace(/```(?:json)?/gi, '').trim();
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (!objMatch) {
    aiLog('error', op, 'no JSON object found in response', { finishReason, raw: responseText.slice(0, 200) });
    const msg = finishReason === 'MAX_TOKENS'
      ? 'The AI response was cut off. Try a shorter message.'
      : 'AI returned an unrecognisable response. Please try again.';
    const err = new Error(msg);
    err.status = 502;
    err.code   = 'PARSE_ERROR';
    throw err;
  }

  let result;
  try { result = JSON.parse(objMatch[0]); }
  catch (e) {
    aiLog('warn', op, 'JSON parse failed, attempting repair', { finishReason, parseError: e.message });
    const repaired = _repairTruncatedJson(objMatch[0]);
    if (repaired && repaired.type) {
      result = repaired;
      aiLog('info', op, 'repaired truncated JSON', { type: result.type });
    } else {
      aiLog('error', op, 'JSON repair failed', { finishReason });
      const msg = finishReason === 'MAX_TOKENS'
        ? 'The AI response was cut off. Try a shorter message.'
        : 'AI returned invalid JSON. Please try again.';
      const err = new Error(msg);
      err.status = 502;
      err.code   = 'PARSE_ERROR';
      throw err;
    }
  }

  aiLog('info', op, 'response type', { type: result.type });

  if (result.type === 'logs') {
    const items = Array.isArray(result.logs) ? result.logs : [result.logs];
    result.logs = items.map(parsed => {
      const matchedType =
        allTypes.find(t => t.id === parsed.logTypeId) ||
        allTypes.find(t => t.name.toLowerCase() === (parsed.logTypeName || '').toLowerCase()) ||
        allTypes.find(t => t.name.toLowerCase().includes((parsed.logTypeName || '').toLowerCase()));
      if (!matchedType) {
        aiLog('warn', op, 'unrecognised log type', { logTypeName: parsed.logTypeName });
        const err = new Error(`Unrecognised log type: "${parsed.logTypeName}". Try rephrasing your message.`);
        err.status = 422;
        err.code   = 'UNRECOGNISED_TYPE';
        throw err;
      }
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
    aiLog('info', op, 'logs parsed', { count: result.logs.length });
  }

  aiLog('info', op, 'done');
  return result;
}

module.exports = { parseLogPrompt, chatWithRenni };
