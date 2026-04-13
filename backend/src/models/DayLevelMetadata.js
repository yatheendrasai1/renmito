const mongoose = require('mongoose');

/**
 * 1.83 — Per-day metadata: day type flag + captured important log snapshots.
 * One document per user per date — upserted on every write.
 */

const importantLogEntrySchema = new mongoose.Schema(
  {
    /** ID of the source TimeLog that provided this time. */
    logId:    { type: mongoose.Schema.Types.ObjectId, ref: 'TimeLog', default: null },
    /** Captured HH:MM time string (local). */
    time:     { type: String, default: null },
    /** YYYY-MM-DD — may differ from the parent document's date (prev / next day). */
    date:     { type: String, default: null },
    /** ISO timestamp of the source log's last update when Capture was clicked. */
    logUpdatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const dayLevelMetadataSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    /** YYYY-MM-DD local date this document represents. */
    date: { type: String, required: true },

    /**
     * Day classification flag.
     * Defaults to 'working' for Mon–Fri; backend does not enforce the default
     * (the frontend seeds it on first open).
     */
    dayType: {
      type:    String,
      enum:    ['working', 'holiday', 'paid_leave', 'sick_leave', 'wfh'],
      default: 'working',
    },

    /**
     * Snapshot captured when the user clicks "Capture" in the Important Logs popup.
     * Each entry stores the time + a reference to the source log so the frontend
     * can detect when that log was later updated (stale warning).
     */
    importantLogs: {
      wokeUp:    { type: importantLogEntrySchema, default: null },
      breakfast: { type: importantLogEntrySchema, default: null },
      lunch:     { type: importantLogEntrySchema, default: null },
      dinner:    { type: importantLogEntrySchema, default: null },
      sleep:     { type: importantLogEntrySchema, default: null },
    },

    /** UTC timestamp of the last successful Capture click. */
    capturedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'daylevelmetadata',
  }
);

// Compound unique index — one doc per user per date.
dayLevelMetadataSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DayLevelMetadata', dayLevelMetadataSchema);
