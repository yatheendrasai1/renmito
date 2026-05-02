const config          = require('../config');
const configSvc       = require('./config.service');
const DefaultLogType  = require('../models/DefaultLogType');
const LogType         = require('../models/LogType');
const TimeLog         = require('../models/TimeLog');

// ── Logger ────────────────────────────────────────────────────────────────────
function aiLog(level, op, msg, extra) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 23);
  const tag = level === 'error' ? '[AI ERROR]' : level === 'warn' ? '[AI WARN]' : '[AI]';
  const line = `${tag} ${ts} [${op}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`;
  if (level === 'error') console.error(line); else console.log(line);
}

// ── IC service proxy ──────────────────────────────────────────────────────────
async function _callIcService(path, payload, op) {
  const url = `${config.ic.serviceUrl}${path}`;
  const t0  = Date.now();
  aiLog('info', op, `calling IC service`, { url, payloadKeys: Object.keys(payload) });

  let resp;
  try {
    resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-ic-secret': config.ic.internalSecret },
      body:    JSON.stringify(payload),
    });
  } catch (e) {
    aiLog('error', op, 'IC service unreachable', { message: e.message });
    const err = new Error('Intelligence service is not running. Start it with: cd intelligence && uvicorn app.main:app --reload');
    err.status = 503;
    err.code   = 'IC_UNAVAILABLE';
    throw err;
  }

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const detail = data.detail || {};
    const message = typeof detail === 'string' ? detail : (detail.error || 'Intelligence service error.');
    const code    = detail.code || 'IC_ERROR';
    aiLog('error', op, 'IC service error', { status: resp.status, message, code });
    const err = new Error(message);
    err.status = resp.status;
    err.code   = code;
    throw err;
  }

  aiLog('info', op, 'IC service ok', { latencyMs: Date.now() - t0 });
  return data;
}

// ── Context helpers ───────────────────────────────────────────────────────────
async function _fetchLogTypes(userId) {
  const [defaultTypes, userTypes] = await Promise.all([
    DefaultLogType.find({ isActive: true }, 'name domain').lean(),
    LogType.find({ userId, isActive: true }, 'name domain').lean(),
  ]);
  return [
    ...defaultTypes.map(t => ({ id: t._id.toString(), name: t.name, domain: t.domain })),
    ...userTypes.map(t => ({ id: t._id.toString(), name: t.name, domain: t.domain })),
  ];
}

async function _fetchLogsContext(userId, date) {
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

  if (logs.length === 0) return 'No logs recorded yet.';

  return logs.map(log => {
    const typeName = log.logTypeId?.name || log.title;
    const logDate  = log.startAt.toISOString().split('T')[0];
    const label    = logDate === date ? 'today' : 'yesterday';
    if (log.entryType === 'point') {
      return `[${label}] ${typeName}: "${log.title}" at ${log.startAt.toISOString().slice(11, 16)}`;
    }
    const end = log.endAt ? log.endAt.toISOString().slice(11, 16) : 'ongoing';
    return `[${label}] ${typeName}: "${log.title}" ${log.startAt.toISOString().slice(11, 16)}–${end}`;
  }).join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────
async function parseLogPrompt(userId, prompt, date) {
  const op = 'parseLog';
  aiLog('info', op, 'start', { userId: userId.toString().slice(-6), promptLen: prompt.length, date });

  const apiKey = await configSvc.getGeminiKey(userId);
  if (!apiKey) {
    const err = new Error('Gemini API key not configured. Go to Configurations to add your key.');
    err.status = 400; err.code = 'NO_API_KEY';
    throw err;
  }

  const logTypes = await _fetchLogTypes(userId);
  aiLog('info', op, 'context ready', { logTypeCount: logTypes.length });

  return _callIcService('/parse-log', { apiKey, date, userInput: prompt, logTypes }, op);
}

async function chatWithRenni(userId, message, date) {
  const op = 'chat';
  aiLog('info', op, 'start', { userId: userId.toString().slice(-6), msgLen: message.length, date });

  const apiKey = await configSvc.getGeminiKey(userId);
  if (!apiKey) {
    const err = new Error('Gemini API key not configured. Go to Configurations to add your key.');
    err.status = 400; err.code = 'NO_API_KEY';
    throw err;
  }

  const [logTypes, logsContext] = await Promise.all([
    _fetchLogTypes(userId),
    _fetchLogsContext(userId, date),
  ]);
  aiLog('info', op, 'context ready', { logTypeCount: logTypes.length });

  return _callIcService('/chat', { apiKey, date, message, logTypes, logsContext }, op);
}

module.exports = { parseLogPrompt, chatWithRenni };
