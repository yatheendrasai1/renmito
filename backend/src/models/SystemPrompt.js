const mongoose = require('mongoose');

const systemPromptSchema = new mongoose.Schema(
  {
    promptId: { type: String, required: true, unique: true },
    type:     { type: String, default: 'system' },
    content:  { type: String, required: true }
  },
  { timestamps: true, collection: 'systemprompts' }
);

module.exports = mongoose.model('SystemPrompt', systemPromptSchema);
