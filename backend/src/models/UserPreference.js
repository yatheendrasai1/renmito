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

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
    },
    palette: { type: paletteSchema, default: null },
  },
  { timestamps: true, collection: 'userPreferences' }
);

module.exports = mongoose.model('UserPreference', userPreferenceSchema);
