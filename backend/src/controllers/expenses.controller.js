const expensesService = require('../services/expenses.service');

// ─── GET /api/expenses ────────────────────────────────────────────────────────
async function listExpenses(req, res) {
  try {
    const { startDate, endDate, entryType, testOnly, page, limit } = req.query;
    const result = await expensesService.listExpenses(req.user.userId, {
      startDate,
      endDate,
      entryType,
      testOnly: testOnly === 'true',
      page:  page  ? parseInt(page,  10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    res.json(result);
  } catch (err) {
    console.error('GET /expenses error:', err.message);
    res.status(500).json({ error: 'Failed to fetch expenses.' });
  }
}

// ─── GET /api/expenses/:id ────────────────────────────────────────────────────
async function getExpense(req, res) {
  try {
    const expense = await expensesService.getExpense(req.user.userId, req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });
    res.json(expense);
  } catch (err) {
    console.error('GET /expenses/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch expense.' });
  }
}

// ─── POST /api/expenses ───────────────────────────────────────────────────────
async function createExpense(req, res) {
  try {
    const { amount, currency, merchant, category, description, date, entryType, smsRaw, smsSender, paymentMethod, referenceId, tags } = req.body;
    if (!amount || !date) {
      return res.status(400).json({ error: 'amount and date are required.' });
    }
    const expense = await expensesService.createExpense(req.user.userId, {
      amount,
      currency:      currency      ?? 'INR',
      merchant:      merchant      ?? '',
      category:      category      ?? 'Uncategorized',
      description:   description   ?? '',
      date:          new Date(date),
      entryType:     entryType     ?? 'manual',
      smsRaw:        smsRaw        ?? '',
      smsSender:     smsSender     ?? '',
      paymentMethod: paymentMethod ?? '',
      referenceId:   referenceId   ?? '',
      tags:          tags          ?? [],
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error('POST /expenses error:', err.message);
    res.status(500).json({ error: 'Failed to create expense.' });
  }
}

// ─── PUT /api/expenses/:id ────────────────────────────────────────────────────
async function updateExpense(req, res) {
  try {
    const expense = await expensesService.updateExpense(req.user.userId, req.params.id, req.body);
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });
    res.json(expense);
  } catch (err) {
    console.error('PUT /expenses/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update expense.' });
  }
}

// ─── DELETE /api/expenses/:id ─────────────────────────────────────────────────
async function deleteExpense(req, res) {
  try {
    await expensesService.deleteExpense(req.user.userId, req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /expenses/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
}

// ─── POST /api/expenses/bulk ──────────────────────────────────────────────────
// Used by the Android SMS plugin to send parsed transactions in a single call.
async function bulkCreateExpenses(req, res) {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries must be a non-empty array.' });
    }
    const created = await expensesService.bulkCreateExpenses(req.user.userId, entries);
    res.status(201).json({ created: created.length });
  } catch (err) {
    console.error('POST /expenses/bulk error:', err.message);
    res.status(500).json({ error: 'Failed to bulk-create expenses.' });
  }
}

module.exports = { listExpenses, getExpense, createExpense, updateExpense, deleteExpense, bulkCreateExpenses };
