const mongoose = require('mongoose');

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

const quickShortcutSchema = new mongoose.Schema(
  {
    logTypeId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    defaultMins: { type: Number, default: 30 },
  },
  { _id: false }
);

const userProfileSchema = new mongoose.Schema(
  {
    dateOfBirth:   { type: Date, default: null },
    weight:        { type: Number, default: null },        // kg
    height:        { type: Number, default: null },        // cm
    targetWeight:  { type: Number, default: null },        // kg
    gender:        { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    activityLevel: {
      type: String,
      enum: ['sedentary', 'light', 'moderate', 'active', 'very-active', ''],
      default: '',
    },
    designation:         { type: String, default: '' },
    designationSince:    { type: Date, default: null },    // when they started current role
    yearsOfExperience:   { type: Number, default: null },
    workDomain:          { type: String, default: '' },
  },
  { _id: false }
);

/**
 * Per-user JIRA integration config.
 * apiToken is stored AES-256-GCM encrypted — never returned to the client in plaintext.
 */
const jiraConfigSchema = new mongoose.Schema(
  {
    baseUrl:  { type: String, default: '' },  // e.g. https://yourcompany.atlassian.net
    email:    { type: String, default: '' },
    apiToken: { type: String, default: '' },  // encrypted ciphertext
  },
  { _id: false }
);

const featuresSchema = new mongoose.Schema(
  {
    foodInsights: {
      enabled: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

/** Per-user ExpenseGuide settings — SMS listener toggle + currency preference. */
const expenseGuideSchema = new mongoose.Schema(
  {
    smsListenerEnabled:          { type: Boolean, default: false },
    notificationEnabled:         { type: Boolean, default: true },
    testListenerEnabled:         { type: Boolean, default: false },
    notificationListenerEnabled: { type: Boolean, default: false },
    currency:                    { type: String,  default: 'INR' },
    defaultCategory:             { type: String,  default: 'Uncategorized' },
  },
  { _id: false }
);

/**
 * 1.83 — Day-level preference defaults stored per user.
 * All times are HH:MM strings in local time.
 */
const daySettingsSchema = new mongoose.Schema(
  {
    wakeTarget:      { type: String, default: '06:30' },
    breakfastTarget: { type: String, default: '08:00' },
    lunchTarget:     { type: String, default: '13:00' },
    dinnerTarget:    { type: String, default: '20:00' },
    workStart:       { type: String, default: '09:00' },
    workEnd:         { type: String, default: '18:00' },
    commuteStart:    { type: String, default: '08:30' }, // leave home for office
    officeReach:     { type: String, default: '09:00' }, // arrive at office
    officeLeave:     { type: String, default: '18:00' }, // leave office for home
    homeReach:       { type: String, default: '19:00' }, // arrive at home
    bedtimeTarget:   { type: String, default: '23:00' },
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
    /** UI theme — 'dark' (default) or 'light'. */
    theme: { type: String, enum: ['light', 'dark'], default: 'dark' },

    /** Currently-running live log, or null when no timer is active. */
    activeLog: { type: activeLogSchema, default: null },

    /** 1.82 — User-configured quick shortcuts list. Empty = use smart defaults. */
    quickShortcuts: { type: [quickShortcutSchema], default: [] },

    /** 1.83 — Day-level schedule preferences (target times). */
    daySettings: { type: daySettingsSchema, default: () => ({}) },

    /** User physical profile used for nutrition and health calculations. */
    userProfile: { type: userProfileSchema, default: () => ({}) },

    /** Feature flags stored per user (enabled/disabled AI-driven features). */
    features: { type: featuresSchema, default: () => ({}) },

    /** ExpenseGuide settings — SMS listener, currency, notification. */
    expenseGuide: { type: expenseGuideSchema, default: () => ({}) },

    /** Per-user JIRA integration credentials (apiToken stored encrypted). */
    jiraConfig: { type: jiraConfigSchema, default: null },
  },
  { timestamps: true, collection: 'userPreferences' }
);

module.exports = mongoose.model('UserPreference', userPreferenceSchema);
