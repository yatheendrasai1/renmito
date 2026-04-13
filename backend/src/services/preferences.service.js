const UserPreference = require('../models/UserPreference');

const MAX_PRESETS = 10;

/**
 * Returns the user's stored preferences (palette, presets, activeLog), or null if none exist.
 */
async function getPreferences(userId) {
  const pref = await UserPreference.findOne({ userId });
  if (!pref) return null;
  return {
    palette:        pref.palette        ?? null,
    customPresets:  pref.customPresets  ?? [],
    activeLog:      pref.activeLog      ?? null,
    quickShortcuts: pref.quickShortcuts ?? [],
    daySettings:    pref.daySettings    ?? {},
  };
}

/**
 * Upserts the active colour palette for the user.
 * Returns { palette }.
 */
async function upsertPalette(userId, { name, bg, primary, secondary, accent }) {
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: { palette: { name: name || 'Custom', bg, primary, secondary, accent } } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { palette: pref.palette };
}

/**
 * Clears the active palette so the app falls back to its defaults.
 */
async function clearPalette(userId) {
  await UserPreference.findOneAndUpdate(
    { userId },
    { $unset: { palette: '' } },
    { upsert: true }
  );
}

/**
 * Adds a named custom preset.
 * Returns { customPresets } or { error, status } if the preset limit is reached.
 */
async function addPreset(userId, { name, bg, primary, secondary, accent }) {
  const existing = await UserPreference.findOne({ userId });
  const current  = existing?.customPresets ?? [];

  if (current.length >= MAX_PRESETS) {
    return {
      error:  `Maximum of ${MAX_PRESETS} custom presets allowed. Delete one before adding another.`,
      status: 422
    };
  }

  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $push: { customPresets: { name, bg, primary, secondary, accent } } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { data: { customPresets: pref.customPresets }, status: 201 };
}

/**
 * Removes the custom preset with the given name.
 * Returns { customPresets } or { error, status } if no preferences found.
 */
async function removePreset(userId, name) {
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $pull: { customPresets: { name } } },
    { new: true }
  );
  if (!pref) return { error: 'No preferences found.', status: 404 };
  return { data: { customPresets: pref.customPresets } };
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
    'workStart', 'workEnd', 'officeReach', 'officeLeave',
    'breakfastTarget', 'lunchTarget', 'dinnerTarget',
    'bedtimeTarget', 'wakeTarget',
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

module.exports = {
  getPreferences,
  upsertPalette,
  clearPalette,
  addPreset,
  removePreset,
  startActiveLog,
  stopActiveLog,
  updateQuickShortcuts,
  updateDaySettings,
};
