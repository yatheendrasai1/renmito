const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
  promptId:    { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  content:     { type: String, required: true },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Prompt', promptSchema);
