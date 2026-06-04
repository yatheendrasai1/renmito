const UserPreference = require('../models/UserPreference');

/**
 * Returns the user's stored preferences or null if none exist.
 */
async function getPreferences(userId) {
  const pref = await UserPreference.findOne({ userId });
  if (!pref) return null;
  return {
    theme:          pref.theme          ?? 'dark',
    activeLog:      pref.activeLog      ?? null,
    quickShortcuts: pref.quickShortcuts ?? [],
    daySettings:    pref.daySettings    ?? {},
    userProfile:    pref.userProfile    ?? {},
    features:       pref.features       ?? {},
    expenseGuide:   pref.expenseGuide   ?? {},
  };
}

/**
 * Saves the user's preferred UI theme ('light' or 'dark').
 */
async function updateTheme(userId, theme) {
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: { theme } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { data: { theme: pref.theme } };
}

/**
 * 1.71 — Starts a live running log.
 * Uses server time for startedAt to avoid cross-device clock skew.
 */
async function startActiveLog(userId, { logTypeId, title, plannedMins }) {
  const startedAt = new Date();
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    {
      $set: {
        activeLog: {
          logTypeId,
          title:       title || '',
          startedAt,
          plannedMins: plannedMins || null,
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { data: { activeLog: pref.activeLog } };
}

/**
 * 1.71 — Clears the running log (called after the log entry has been saved).
 */
async function stopActiveLog(userId) {
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $unset: { activeLog: '' } },
    { new: true }
  );
  if (!pref) return { error: 'No preferences found.', status: 404 };
  return { data: null };
}

/**
 * 1.82 — Saves the user's quick shortcuts list.
 */
async function updateQuickShortcuts(userId, shortcuts) {
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: { quickShortcuts: shortcuts } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { data: { quickShortcuts: pref.quickShortcuts } };
}

/**
 * 1.83 — Saves day-level schedule preference defaults.
 */
async function updateDaySettings(userId, settings) {
  const allowed = [
    'wakeTarget', 'breakfastTarget', 'lunchTarget', 'dinnerTarget',
    'workStart', 'workEnd',
    'commuteStart', 'officeReach', 'officeLeave', 'homeReach',
    'bedtimeTarget',
  ];
  const update = {};
  for (const key of allowed) {
    if (settings[key] !== undefined) update[`daySettings.${key}`] = settings[key];
  }
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { data: { daySettings: pref.daySettings } };
}

async function updateUserProfile(userId, profile) {
  const allowed = ['dateOfBirth', 'weight', 'height', 'gender', 'activityLevel'];
  const update = {};
  for (const key of allowed) {
    if (profile[key] !== undefined) {
      update[`userProfile.${key}`] = profile[key] === '' ? null : profile[key];
    }
  }
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { data: { userProfile: pref.userProfile } };
}

async function updateFeatures(userId, features) {
  const update = {};
  if (features?.foodInsights?.enabled !== undefined) {
    update['features.foodInsights.enabled'] = !!features.foodInsights.enabled;
  }
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { data: { features: pref.features } };
}

async function updateExpenseGuide(userId, settings) {
  const allowed = ['smsListenerEnabled', 'notificationEnabled', 'testListenerEnabled', 'notificationListenerEnabled', 'currency', 'defaultCategory'];
  const update  = {};
  for (const key of allowed) {
    if (settings[key] !== undefined) update[`expenseGuide.${key}`] = settings[key];
  }
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { data: { expenseGuide: pref.expenseGuide } };
}

module.exports = {
  getPreferences,
  updateTheme,
  startActiveLog,
  stopActiveLog,
  updateQuickShortcuts,
  updateDaySettings,
  updateUserProfile,
  updateFeatures,
  updateExpenseGuide,
};
