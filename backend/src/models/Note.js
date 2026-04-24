const mongoose = require('mongoose');

const noteItemSchema = new mongoose.Schema(
  { content: { type: String, default: '', maxlength: 500 } }
);

const noteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date:   { type: String, required: true }, // YYYY-MM-DD
    notes:  { type: [noteItemSchema], default: [] },
  },
  { timestamps: true, collection: 'notes' }
);

noteSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Note', noteSchema);
