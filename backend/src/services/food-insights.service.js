const UserPreference = require('../models/UserPreference');
const FoodInsight    = require('../models/FoodInsight');
const TimeLog        = require('../models/TimeLog');
const DefaultLogType = require('../models/DefaultLogType');
const LogType        = require('../models/LogType');
const configSvc      = require('./config.service');
const aiSvc          = require('./ai.service');

// ── Constants ─────────────────────────────────────────────────────────────────

const FOOD_LOG_NAMES = ['breakfast', 'lunch', 'dinner', 'food intake'];

const FOOD_INSIGHTS_SYSTEM_PROMPT = `You are a precise nutrition analysis assistant. When given a meal log, analyse the food items and return a structured nutritional breakdown.

Guidelines:
- Base calorie estimates on standard portion sizes if quantity is not specified
- Use average values for dishes unless cooking method/oil suggests otherwise
- For cumulative daily totals, sum across all meals listed as previous meals
- If information is insufficient for a field, state "Insufficient data" rather than guessing wildly
- Express confidence where data allows; flag assumptions clearly
- Keep the entire response under 150 words — be concise and prioritise numbers
- Format your response using Markdown (bold for labels, bullet lists for breakdowns)`;

const FOOD_INSIGHTS_USER_PROMPT_TEMPLATE = `Analyse this meal log:
- Meal: {mealType}
- Time: {time}
- Items: {items}
- User profile: {userProfile}

Previous meals today:
{previousMeals}

Return (in Markdown, max 150 words total):
1. Total calories and % of daily quota
2. Macronutrient breakdown (carbs, protein, fat in g and %)
3. Fat % of total calories, split by saturated/unsaturated where possible
4. Protein and fibre (g) with a one-line quality note
5. Cumulative day totals so far (including this meal)`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isFoodLog(logTypeDoc) {
  if (!logTypeDoc) return false;
  if (logTypeDoc.domain !== 'personal') return false;
  const name = (logTypeDoc.name || '').toLowerCase().trim();
  return FOOD_LOG_NAMES.includes(name);
}

function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function formatUserProfile(userProfile) {
  if (!userProfile) return 'Not provided';
  const age    = computeAge(userProfile.dateOfBirth);
  const parts  = [];
  if (age)                   parts.push(`age ${age}`);
  if (userProfile.weight)    parts.push(`${userProfile.weight} kg`);
  if (userProfile.height)    parts.push(`${userProfile.height} cm`);
  if (userProfile.gender)    parts.push(userProfile.gender);
  if (userProfile.activityLevel) parts.push(`${userProfile.activityLevel} activity`);
  return parts.length ? parts.join(', ') : 'Not provided';
}

function toUTCTimeStr(date) {
  if (!date) return 'unknown';
  return [
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
  ].join(':');
}

async function fetchEarlierFoodLogs(userId, date, beforeTime) {
  const dayStart = new Date(`${date}T00:00:00.000Z`);

  const docs = await TimeLog.find({
    userId,
    startAt: { $gte: dayStart, $lt: beforeTime },
    status:  { $ne: 'cancelled' },
  }).lean();

  if (!docs.length) return [];

  const logTypeIds = [...new Set(docs.map(d => d.logTypeId.toString()))];

  const [defaults, userTypes] = await Promise.all([
    DefaultLogType.find({ _id: { $in: logTypeIds } }, 'name domain').lean(),
    LogType.find({ _id: { $in: logTypeIds } }, 'name domain').lean(),
  ]);
  const typeMap = {};
  [...defaults, ...userTypes].forEach(t => { typeMap[t._id.toString()] = t; });

  const foodLogs = [];
  for (const doc of docs) {
    const lt = typeMap[doc.logTypeId.toString()];
    if (lt && lt.domain === 'personal' && FOOD_LOG_NAMES.includes((lt.name || '').toLowerCase().trim())) {
      foodLogs.push(`${lt.name} at ${toUTCTimeStr(doc.startAt)}: ${doc.title || 'no description'}`);
    }
  }
  return foodLogs;
}

function buildPrompt(mealType, time, items, userProfileStr, previousMeals) {
  const prevSection = previousMeals.length
    ? previousMeals.join('\n')
    : 'None yet';

  return FOOD_INSIGHTS_USER_PROMPT_TEMPLATE
    .replace('{mealType}',      mealType)
    .replace('{time}',          time)
    .replace('{items}',         items || 'no description')
    .replace('{userProfile}',   userProfileStr)
    .replace('{previousMeals}', prevSection);
}

// ── Shared analysis runner ────────────────────────────────────────────────────

async function _runAnalysis(userId, populatedLog, userProfile) {
  const lt       = populatedLog.logTypeId && typeof populatedLog.logTypeId === 'object'
    ? populatedLog.logTypeId : null;
  const apiKey   = await configSvc.getGeminiKey(userId);
  if (!apiKey) {
    const err = new Error('Gemini API key not configured.');
    err.status = 400; err.code = 'NO_API_KEY';
    throw err;
  }

  const date     = populatedLog.startAt.toISOString().slice(0, 10);
  const mealType = lt.name;
  const time     = toUTCTimeStr(populatedLog.startAt);
  const items    = populatedLog.title || 'no description';

  const [previousMeals, existingInsight] = await Promise.all([
    fetchEarlierFoodLogs(userId, date, populatedLog.startAt),
    FoodInsight.findOne({ logId: populatedLog._id }),
  ]);

  const record = existingInsight
    ? await FoodInsight.findOneAndUpdate(
        { logId: populatedLog._id },
        { $set: { status: 'pending', analysis: '', error: null, mealType, date } },
        { new: true }
      )
    : await FoodInsight.create({ userId, logId: populatedLog._id, date, mealType, status: 'pending' });

  try {
    const userProfileStr = formatUserProfile(userProfile);
    const userPrompt = buildPrompt(mealType, time, items, userProfileStr, previousMeals);
    const result   = await aiSvc.callFoodInsight(apiKey, FOOD_INSIGHTS_SYSTEM_PROMPT, userPrompt);
    const analysis = result.analysis;
    const updated  = await FoodInsight.findOneAndUpdate(
      { _id: record._id },
      { $set: { status: 'done', analysis } },
      { new: true }
    ).lean();
    console.log(`[FoodInsights] analysis done for log ${populatedLog._id.toString().slice(-6)}`);
    return updated;
  } catch (err) {
    await FoodInsight.findOneAndUpdate(
      { _id: record._id },
      { $set: { status: 'error', error: err.message } }
    );
    console.error(`[FoodInsights] error for log ${populatedLog._id.toString().slice(-6)}:`, err.message);
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function triggerFoodInsights(userId, populatedLog) {
  const lt = populatedLog.logTypeId && typeof populatedLog.logTypeId === 'object'
    ? populatedLog.logTypeId : null;
  if (!isFoodLog(lt)) return;

  const pref = await UserPreference.findOne({ userId }, 'features userProfile').lean();
  if (!pref?.features?.foodInsights?.enabled) return;

  await _runAnalysis(userId, populatedLog, pref?.userProfile);
}

async function generateInsight(userId, logId) {
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(logId)) {
    const err = new Error('Invalid log ID.'); err.status = 400; throw err;
  }

  const log = await TimeLog.findOne({ _id: logId, userId })
    .populate({ path: 'logTypeId', select: 'name color domain category' })
    .lean();
  if (!log) { const err = new Error('Log not found.'); err.status = 404; throw err; }

  const lt = log.logTypeId && typeof log.logTypeId === 'object' ? log.logTypeId : null;
  if (!isFoodLog(lt)) {
    const err = new Error('Log is not a food log (must be personal domain with a food log type).');
    err.status = 400; throw err;
  }

  const pref = await UserPreference.findOne({ userId }, 'userProfile').lean();
  return _runAnalysis(userId, log, pref?.userProfile);
}

async function getInsightByLogId(userId, logId) {
  return FoodInsight.findOne({ logId, userId }).lean();
}

async function getInsightsByDate(userId, date) {
  return FoodInsight.find({ userId, date }).lean();
}

module.exports = { triggerFoodInsights, generateInsight, getInsightByLogId, getInsightsByDate, FOOD_INSIGHTS_SYSTEM_PROMPT };
