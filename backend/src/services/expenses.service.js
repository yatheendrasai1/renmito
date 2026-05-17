const Expense = require('../models/Expense');

async function listExpenses(userId, { startDate, endDate, entryType, page = 1, limit = 50 } = {}) {
  const query = { userId };
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate)   query.date.$lte = new Date(endDate);
  }
  if (entryType) query.entryType = entryType;

  const skip  = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Expense.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    Expense.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

async function getExpense(userId, expenseId) {
  return Expense.findOne({ _id: expenseId, userId }).lean();
}

async function createExpense(userId, data) {
  const expense = await Expense.create({ ...data, userId });
  return expense.toObject();
}

async function updateExpense(userId, expenseId, data) {
  const expense = await Expense.findOneAndUpdate(
    { _id: expenseId, userId },
    { $set: data },
    { new: true }
  ).lean();
  return expense;
}

async function deleteExpense(userId, expenseId) {
  await Expense.deleteOne({ _id: expenseId, userId });
}

/** Creates expenses in bulk — used by the SMS parser (automatic entries). */
async function bulkCreateExpenses(userId, entries) {
  const docs = entries.map(e => ({ ...e, userId, entryType: 'automatic' }));
  return Expense.insertMany(docs);
}

module.exports = {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  bulkCreateExpenses,
};
