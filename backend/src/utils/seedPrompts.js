const Prompt = require('../models/Prompt');
const prompts = require('../data/prompts.json');

async function seedPrompts() {
  for (const p of prompts) {
    await Prompt.updateOne(
      { promptId: p.promptId },
      { $setOnInsert: { content: p.content, name: p.name, description: p.description, isActive: true } },
      { upsert: true }
    );
  }
}

module.exports = seedPrompts;
