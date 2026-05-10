const Insight      = require('../models/Insight');
const SystemPrompt = require('../models/SystemPrompt');
const Prompt       = require('../models/Prompt');
const TimeLog      = require('../models/TimeLog');
const config       = require('../config');
const configSvc    = require('./config.service');

// Keywords that identify food-related log entries
const FOOD_KEYWORDS = [
  'food', 'eat', 'ate', 'meal', 'breakfast', 'lunch', 'dinner', 'brunch',
  'snack', 'drink', 'coffee', 'tea', 'water', 'juice', 'cook', 'cooking',
  'diet', 'calorie', 'protein', 'carb', 'fat', 'dairy', 'fruit', 'vegetable',
  'meat', 'fish', 'chicken', 'rice', 'bread', 'salad', 'soup', 'fast', 'fasting',
  'nutrition', 'pizza', 'burger', 'pasta', 'noodle', 'dessert', 'sweet',
  'cheat', 'healthy', 'junk'
];

function isFoodRelated(log) {
  const haystack = [
    log.title || '',
    log.logTypeId?.name || ''
  ].join(' ').toLowerCase();
  return FOOD_KEYWORDS.some(kw => haystack.includes(kw));
}

function formatLogLine(log, dateLabel) {
  const typeName = log.logTypeId?.name || log.title;
  if (log.entryType === 'point') {
    return `[${dateLabel}] ${typeName}: "${log.title}" at ${log.startAt.toISOString().slice(11, 16)}`;
  }
  const end = log.endAt ? log.endAt.toISOString().slice(11, 16) : 'ongoing';
  return `[${dateLabel}] ${typeName}: "${log.title}" ${log.startAt.toISOString().slice(11, 16)}–${end}`;
}

async function _callIcService(path, payload) {
  const url = `${config.ic.serviceUrl}${path}`;
  let resp;
  try {
    resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-ic-secret': config.ic.internalSecret },
      body:    JSON.stringify(payload),
    });
  } catch {
    const err = new Error('Intelligence service is not running.');
    err.status = 503; err.code = 'IC_UNAVAILABLE';
    throw err;
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail  = data.detail || {};
    const message = typeof detail === 'string' ? detail : (detail.error || 'Intelligence service error.');
    const code    = detail.code || 'IC_ERROR';
    const err = new Error(message);
    err.status = resp.status; err.code = code;
    throw err;
  }
  return data;
}

function fmtUserInsight(doc) {
  return {
    _id:      doc._id.toString(),
    type:     doc.type,
    model:    doc.model,
    promptId: doc.promptId ? doc.promptId.toString() : null,
    enabled:  doc.enabled
  };
}

async function getAll(userId) {
  const [systemTemplates, userInsights] = await Promise.all([
    Insight.find({ accountId: null }).lean(),
    Insight.find({ accountId: userId }).lean()
  ]);

  const userMap = {};
  for (const ui of userInsights) {
    userMap[ui.label] = ui;
  }

  return systemTemplates.map(template => ({
    _id:              template._id.toString(),
    name:             template.name,
    label:            template.label,
    model:            template.model,
    isSystemTemplate: true,
    userInsight:      userMap[template.label] ? fmtUserInsight(userMap[template.label]) : null
  }));
}

async function getById(userId, insightId) {
  const insight = await Insight.findOne({
    _id: insightId,
    $or: [{ accountId: null }, { accountId: userId }]
  }).lean();
  if (!insight) throw new Error('Not found');

  let promptContent = null;
  if (insight.type === 'system' && insight.promptId) {
    const sp = await SystemPrompt.findOne({ promptId: insight.promptId.toString() }).lean();
    promptContent = sp?.content || null;
  } else if (insight.type === 'custom' && insight.promptId) {
    const p = await Prompt.findById(insight.promptId).lean();
    promptContent = p?.content || null;
  }

  return {
    _id:           insight._id.toString(),
    name:          insight.name,
    label:         insight.label,
    type:          insight.type,
    model:         insight.model,
    promptId:      insight.promptId ? insight.promptId.toString() : null,
    promptContent,
    accountId:     insight.accountId ? insight.accountId.toString() : null,
    enabled:       insight.enabled
  };
}

async function createUserInsight(userId, { label, name, model, type, promptId }) {
  const existing = await Insight.findOne({ accountId: userId, label }).lean();
  if (existing) {
    return {
      _id:       existing._id.toString(),
      name:      existing.name,
      label:     existing.label,
      type:      existing.type,
      model:     existing.model,
      promptId:  existing.promptId ? existing.promptId.toString() : null,
      accountId: userId.toString(),
      enabled:   existing.enabled
    };
  }

  const doc = await Insight.create({
    name,
    label,
    type:      type || 'system',
    promptId:  promptId || label,
    model:     model || 'gemini',
    accountId: userId,
    enabled:   true
  });

  return {
    _id:       doc._id.toString(),
    name:      doc.name,
    label:     doc.label,
    type:      doc.type,
    model:     doc.model,
    promptId:  doc.promptId ? doc.promptId.toString() : null,
    accountId: userId.toString(),
    enabled:   doc.enabled
  };
}

async function updateInsight(userId, insightId, updates) {
  const allowed = {};
  if (updates.type     !== undefined) allowed.type     = updates.type;
  if (updates.model    !== undefined) allowed.model    = updates.model;
  if (updates.promptId !== undefined) allowed.promptId = updates.promptId;
  if (updates.enabled  !== undefined) allowed.enabled  = updates.enabled;

  const doc = await Insight.findOneAndUpdate(
    { _id: insightId, accountId: userId },
    allowed,
    { new: true }
  );
  if (!doc) throw new Error('Not found');

  return {
    _id:       doc._id.toString(),
    name:      doc.name,
    label:     doc.label,
    type:      doc.type,
    model:     doc.model,
    promptId:  doc.promptId ? doc.promptId.toString() : null,
    accountId: userId.toString(),
    enabled:   doc.enabled
  };
}

async function analyzeInsight(userId, insightId, period, customStartDate, customEndDate) {
  // Load insight + resolve prompt content
  const insight = await Insight.findOne({ _id: insightId, accountId: userId }).lean();
  if (!insight) throw new Error('Not found');

  let promptContent = null;
  if (insight.type === 'system' && insight.promptId) {
    const sp = await SystemPrompt.findOne({ promptId: insight.promptId.toString() }).lean();
    promptContent = sp?.content || null;
  } else if (insight.type === 'custom' && insight.promptId) {
    const p = await Prompt.findById(insight.promptId).lean();
    promptContent = p?.content || null;
  }
  if (!promptContent) throw new Error('No prompt configured for this insight.');

  // Gemini API key
  const apiKey = await configSvc.getGeminiKey(userId);
  if (!apiKey) {
    const err = new Error('Gemini API key not configured. Go to Configurations to add your key.');
    err.status = 400; err.code = 'NO_API_KEY';
    throw err;
  }

  // Build date range
  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  let startDate, endDate;

  if (period === 'today') {
    startDate = endDate = todayStr;
  } else if (period === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    startDate = endDate = d.toISOString().slice(0, 10);
  } else if (period === 'last7days') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    startDate = d.toISOString().slice(0, 10);
    endDate   = todayStr;
  } else if (period === 'custom') {
    startDate = customStartDate;
    endDate   = customEndDate;
  } else {
    throw new Error('Invalid period. Use: today | yesterday | last7days | custom');
  }

  // Fetch logs for the period
  const logs = await TimeLog.find({
    userId,
    startAt: {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
      $lte: new Date(`${endDate}T23:59:59.999Z`),
    },
    status: { $ne: 'cancelled' },
  }).populate('logTypeId', 'name').sort({ startAt: 1 }).lean();

  // Filter to food-related logs only
  const foodLogs = logs.filter(isFoodRelated);

  // Format log context
  let logsContext;
  if (foodLogs.length === 0) {
    logsContext = 'No food-related logs found for this period.';
  } else {
    logsContext = foodLogs.map(log => {
      const logDate = log.startAt.toISOString().slice(0, 10);
      return formatLogLine(log, logDate);
    }).join('\n');
  }

  // Build the full compiled prompt.
  // Append the JSON wrapper instruction so the IC service's extract_json parser
  // can find the expected {"type":"answer","text":"..."} envelope in Gemini's response.
  const fullPrompt = [
    promptContent,
    '---',
    `User's food log entries for analysis:\n${logsContext}`,
    '---',
    'Return ONLY valid JSON, no markdown, no explanation:',
    '{"type":"answer","text":"<your full analysis here, use \\n for line breaks>"}'
  ].join('\n\n');

  // Call IC service /chat with the compiled prompt as template_override
  const result = await _callIcService('/chat', {
    apiKey,
    date:         endDate,
    message:      'Generate insights based on the food log entries provided.',
    logTypes:     [],
    logsContext:  '',
    promptTemplate: fullPrompt,
  });

  // Build a simplified summary of the logs that were used
  const logSummaries = foodLogs.map(log => ({
    title:       log.title,
    logTypeName: log.logTypeId?.name || log.title,
    startAt:     log.startAt.toISOString(),
    endAt:       log.endAt ? log.endAt.toISOString() : null,
    entryType:   log.entryType,
  }));

  return {
    period,
    startDate,
    endDate,
    foodLogCount: foodLogs.length,
    logs:         logSummaries,
    text:         result.text || 'No response generated.'
  };
}

module.exports = { getAll, getById, createUserInsight, updateInsight, analyzeInsight };
