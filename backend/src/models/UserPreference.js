const mongoose = require('mongoose');

/**
 * Stores per-user UI preferences.
 * One document per user — upserted on every palette change.
 */
const paletteSchema = new mongoose.Schema(
  {
    name:      { type: String, default: 'Custom' },
    bg:        { type: String, required: true },   // body / surfaces
    primary:   { type: String, required: true },   // nav sidebar
    secondary: { type: String, required: true },   // header + timeline
    accent:    { type: String, required: true },   // CTA / highlights
  },
  { _id: false }
);

/**
 * 1.71 — Stores the currently-running live log (started but not yet stopped).
 * Persisted in DB so the timer state is consistent across devices.
 * startedAt is set by the server to avoid cross-device clock skew.
 */
const activeLogSchema = new mongoose.Schema(
  {
    logTypeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'LogType', required: true },
    title:       { type: String, default: '' },
    startedAt:   { type: Date, required: true },      // server-side UTC timestamp
    plannedMins: { type: Number, default: null },      // optional planned duration (1.72)
  },
  { _id: false }
);

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
    },
    /** The currently active palette (applied on load). */
    palette: { type: paletteSchema, default: null },

    /**
     * User-saved named presets — max 10 per account.
     * Each entry has its own _id so it can be deleted individually.
     */
    customPresets: {
      type:    [paletteSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message:   'Maximum of 10 custom presets allowed per account.'
      }
    },

    /** Currently-running live log, or null when no timer is active. */
    activeLog: { type: activeLogSchema, default: null },
  },
  { timestamps: true, collection: 'userPreferences' }
);

module.exports = mongoose.model('UserPreference', userPreferenceSchema);
