const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    amount:   { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    merchant:    { type: String, default: '' },
    category:    { type: String, default: 'Uncategorized' },
    description: { type: String, default: '' },

    date: { type: Date, required: true },

    /** 'manual' = user entered by hand; 'automatic' = parsed from incoming SMS */
    entryType: {
      type:    String,
      enum:    ['manual', 'automatic'],
      default: 'manual',
      index:   true,
    },

    /** Raw SMS body captured for automatic entries — empty for manual entries. */
    smsRaw:    { type: String, default: '' },
    smsSender: { type: String, default: '' },

    paymentMethod: { type: String, default: '' }, // UPI, Card, Net Banking…
    referenceId:   { type: String, default: '' }, // bank/UPI transaction reference

    tags: [{ type: String }],
  },
  { timestamps: true, collection: 'expenses' }
);

expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, entryType: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
