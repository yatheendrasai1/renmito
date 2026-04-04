const mongoose = require('mongoose');

const enhancementSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true },
  version:       { type: String, required: true },
  type:          { type: String, enum: ['feature', 'minor', 'major', 'trivial', 'internal'], required: true },
  title:         { type: String, required: true },
  description:   { type: String, default: '' },
  status:        { type: String, enum: ['implemented', 'in-progress', 'planned'], default: 'implemented' },
  implementedAt: { type: Date, default: null },
  tags:          [{ type: String }],
  relatedTo:     [{ type: String }],
  requestedBy:   { type: String, default: 'owner' },
  breaking:      { type: Boolean, default: false },
  notes:         { type: String, default: '' }
}, {
  collection: 'enhancements',
  timestamps:  true
});

module.exports = mongoose.model('Enhancement', enhancementSchema);
