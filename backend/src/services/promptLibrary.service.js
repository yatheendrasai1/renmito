const Prompt = require('../models/Prompt');

/**
 * Fetches a prompt template by its promptId and substitutes {{key}} placeholders.
 * Throws if the prompt is not found or inactive.
 */
async function getPrompt(promptId, vars = {}) {
  const prompt = await Prompt.findOne({ promptId, isActive: true }).lean();
  if (!prompt) throw new Error(`Prompt not found: ${promptId}`);

  let content = prompt.content;
  for (const [key, value] of Object.entries(vars)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  return content;
}

module.exports = { getPrompt };
