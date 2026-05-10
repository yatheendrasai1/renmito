const Prompt = require('../models/Prompt');

async function createPrompt(userId, { content, insightId }) {
  if (!content || !content.trim()) throw new Error('Content is required');
  const doc = await Prompt.create({
    type:      'custom',
    accountId: userId,
    insightId: insightId || null,
    content
  });
  return { _id: doc._id.toString(), content: doc.content, type: doc.type };
}

async function updatePrompt(userId, promptId, { content }) {
  if (!content || !content.trim()) throw new Error('Content cannot be empty');
  const doc = await Prompt.findOneAndUpdate(
    { _id: promptId, accountId: userId },
    { content },
    { new: true }
  );
  if (!doc) throw new Error('Not found');
  return { _id: doc._id.toString(), content: doc.content, type: doc.type };
}

async function getById(userId, promptId) {
  const doc = await Prompt.findOne({ _id: promptId, accountId: userId }).lean();
  if (!doc) throw new Error('Not found');
  return { _id: doc._id.toString(), content: doc.content, type: doc.type };
}

module.exports = { createPrompt, updatePrompt, getById };
