const UserPreference = require('../models/UserPreference');

const MAX_PRESETS = 10;

/**
 * Returns the user's stored preferences, or null if none exist yet.
 */
async function getPreferences(userId) {
  const pref = await UserPreference.findOne({ userId });
  if (!pref) return null;
  return {
    palette:       pref.palette       ?? null,
    customPresets: pref.customPresets ?? []
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

module.exports = {
  getPreferences,
  upsertPalette,
  clearPalette,
  addPreset,
  removePreset
};
