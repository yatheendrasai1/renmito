const SystemPrompt = require('../models/SystemPrompt');

async function getByPromptId(promptId) {
  const doc = await SystemPrompt.findOne({ promptId }).lean();
  if (!doc) return null;
  return { promptId: doc.promptId, type: doc.type, content: doc.content };
}

module.exports = { getByPromptId };
