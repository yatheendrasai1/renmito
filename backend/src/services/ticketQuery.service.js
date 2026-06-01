const TicketQuery = require('../models/TicketQuery');
const { searchJira } = require('./jira.service');

const MAX_QUERIES = 15;

async function listQueries(userId) {
  return TicketQuery.find({ userId }).sort({ createdAt: -1 }).lean();
}

async function verifyAndSaveQuery(userId, { name, jql }) {
  const count = await TicketQuery.countDocuments({ userId });
  if (count >= MAX_QUERIES) {
    const err = new Error(`Maximum of ${MAX_QUERIES} queries reached.`);
    err.status = 400;
    throw err;
  }
  // Verify JQL with JIRA — throws if invalid
  await searchJira(userId, { jql, maxResults: 1 });
  const query = await TicketQuery.create({ userId, name, jql, isValid: true });
  return query;
}

async function verifyAndUpdateQuery(userId, id, { name, jql }) {
  // Verify JQL with JIRA — throws if invalid
  await searchJira(userId, { jql, maxResults: 1 });
  const query = await TicketQuery.findOneAndUpdate(
    { _id: id, userId },
    { name, jql, isValid: true },
    { new: true }
  );
  if (!query) {
    const err = new Error('Query not found.');
    err.status = 404;
    throw err;
  }
  return query;
}

async function deleteQuery(userId, id) {
  const result = await TicketQuery.findOneAndDelete({ _id: id, userId });
  if (!result) {
    const err = new Error('Query not found.');
    err.status = 404;
    throw err;
  }
}

async function cloneQuery(userId, id) {
  const count = await TicketQuery.countDocuments({ userId });
  if (count >= MAX_QUERIES) {
    const err = new Error(`Maximum of ${MAX_QUERIES} queries reached.`);
    err.status = 400;
    throw err;
  }
  const source = await TicketQuery.findOne({ _id: id, userId }).lean();
  if (!source) {
    const err = new Error('Query not found.');
    err.status = 404;
    throw err;
  }
  const clone = await TicketQuery.create({
    userId,
    name: `Copy of ${source.name}`,
    jql: source.jql,
    isValid: false,   // must be re-verified after modification
  });
  // Return clone with sourceJql so the UI can detect unmodified state
  return { ...clone.toObject(), sourceJql: source.jql };
}

module.exports = { listQueries, verifyAndSaveQuery, verifyAndUpdateQuery, deleteQuery, cloneQuery };
