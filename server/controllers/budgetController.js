// server/controllers/budgetController.js

const { db } = require('../db/database');
const { authorizeTrip, getTripIdForExpense } = require('../utils/tripAuth');
const { validationResult } = require('express-validator');
const { emitToTrip } = require('../utils/socketService');
const { getRate, isValidCode } = require('../utils/currencyService');

/** Trip member ids for validation of payers/participants. */
const getTripMemberIds = (tripId) =>
  db.prepare('SELECT user_id FROM trip_members WHERE trip_id = ?').all(tripId).map(m => m.user_id);

/**
 * Normalize settlement fields from a request body.
 * Returns { paidBy, splitIds } (both null when not participating in
 * settlement) or `false` when the payer/participants aren't trip members.
 */
const resolveSettlementFields = (body, tripId) => {
  const rawPaidBy = body.paid_by;
  if (rawPaidBy === undefined || rawPaidBy === null || rawPaidBy === '') {
    return { paidBy: null, splitIds: null };
  }
  const paidBy = parseInt(rawPaidBy, 10);
  const members = new Set(getTripMemberIds(tripId));
  if (Number.isNaN(paidBy) || !members.has(paidBy)) return false;

  let splitIds = Array.isArray(body.split_user_ids) ? body.split_user_ids.map(Number) : [];
  splitIds = [...new Set(splitIds)];
  if (splitIds.length === 0) splitIds = [...members]; // default: everyone
  if (splitIds.some(id => Number.isNaN(id) || !members.has(id))) return false;
  return { paidBy, splitIds };
};

const writeSplits = db.transaction((expenseId, splitIds) => {
  db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(expenseId);
  const ins = db.prepare('INSERT INTO expense_splits (expense_id, user_id) VALUES (?, ?)');
  for (const uid of splitIds) ins.run(expenseId, uid);
});

/** Attach split_user_ids to a list of expenses. */
const attachSplits = (expenses) => {
  if (expenses.length === 0) return expenses;
  const placeholders = expenses.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT expense_id, user_id FROM expense_splits WHERE expense_id IN (${placeholders})`
  ).all(...expenses.map(e => e.id));
  const byExpense = new Map();
  rows.forEach(r => {
    if (!byExpense.has(r.expense_id)) byExpense.set(r.expense_id, []);
    byExpense.get(r.expense_id).push(r.user_id);
  });
  return expenses.map(e => ({ ...e, split_user_ids: byExpense.get(e.id) || [] }));
};

/**
 * Get a budget for a trip
 */
const getTripBudget = async (req, res) => {
  try {
    const { tripId } = req.params;

    // Get budget
    const budget = db.prepare('SELECT * FROM budgets WHERE trip_id = ?').get(tripId);

    // If no budget exists, return null
    if (!budget) {
      return res.status(200).json({ budget: null, expenses: [] });
    }

    // Get expenses (with settlement splits)
    const expenses = attachSplits(
      db.prepare('SELECT * FROM expenses WHERE budget_id = ? ORDER BY date DESC').all(budget.id)
    );

    // Home-currency conversion, when both ISO codes are configured
    let conversion = null;
    if (isValidCode(budget.currency_code) && isValidCode(budget.home_currency_code)
        && budget.currency_code !== budget.home_currency_code) {
      const rate = await getRate(budget.currency_code, budget.home_currency_code);
      if (rate) {
        conversion = {
          home_currency_code: budget.home_currency_code,
          rate: rate.rate,
          rate_fetched_at: rate.fetched_at,
        };
      }
    }

    // Calculate category totals
    const categories = ['transport', 'lodging', 'activities', 'food', 'other'];
    const categoryTotals = {};

    categories.forEach(category => {
      const total = db.prepare(`
        SELECT SUM(amount) as total FROM expenses 
        WHERE budget_id = ? AND category = ?
      `).get(budget.id, category);

      categoryTotals[category] = total.total || 0;
    });

    // Calculate total spent
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE budget_id = ?')
      .get(budget.id).total || 0;

    return res.status(200).json({
      budget,
      expenses,
      categoryTotals,
      totalSpent,
      conversion
    });
  } catch (error) {
    console.error('Get trip budget error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create a budget for a trip
 */
const createBudget = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tripId } = req.params;
    const { total_amount, currency, currency_code, home_currency_code } = req.body;

    for (const code of [currency_code, home_currency_code]) {
      if (code && !isValidCode(code)) {
        return res.status(400).json({ message: 'Currency codes must be 3-letter ISO codes (e.g. JPY)' });
      }
    }

    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if budget already exists
    const existingBudget = db.prepare('SELECT * FROM budgets WHERE trip_id = ?').get(tripId);
    if (existingBudget) {
      return res.status(400).json({ message: 'Budget already exists for this trip' });
    }

    // Insert budget
    const insert = db.prepare(`
      INSERT INTO budgets (trip_id, total_amount, currency, currency_code, home_currency_code)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insert.run(tripId, total_amount, currency || '$', currency_code || null, home_currency_code || null);

    // Get the created budget
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(result.lastInsertRowid);

    // Emit socket event for real-time updates
    emitToTrip(tripId, 'budget:created', budget);

    return res.status(201).json({
      message: 'Budget created successfully',
      budget
    });
  } catch (error) {
    console.error('Create budget error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a budget
 */
const updateBudget = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { budgetId } = req.params;
    const { total_amount, currency, currency_code, home_currency_code } = req.body;

    for (const code of [currency_code, home_currency_code]) {
      if (code && !isValidCode(code)) {
        return res.status(400).json({ message: 'Currency codes must be 3-letter ISO codes (e.g. JPY)' });
      }
    }

    // Check if budget exists
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    // Authorize against the budget's own trip (route middleware trusts a client-supplied id)
    if (!authorizeTrip(res, budget.trip_id, req.user.id, 'edit')) return;

    // Update budget (undefined keeps, empty string clears a code)
    const nextCode = (incoming, current) =>
      incoming === undefined ? current : (incoming || null);

    const update = db.prepare(`
      UPDATE budgets
      SET total_amount = ?, currency = ?, currency_code = ?, home_currency_code = ?
      WHERE id = ?
    `);

    update.run(
      total_amount,
      currency || budget.currency,
      nextCode(currency_code, budget.currency_code),
      nextCode(home_currency_code, budget.home_currency_code),
      budgetId
    );

    // Get updated budget
    const updatedBudget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);

    // Emit socket event for real-time updates
    emitToTrip(updatedBudget.trip_id, 'budget:updated', updatedBudget);

    return res.status(200).json({
      message: 'Budget updated successfully',
      budget: updatedBudget
    });
  } catch (error) {
    console.error('Update budget error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Add an expense to a budget
 */
const addExpense = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { budgetId } = req.params;
    const { name, amount, category, date, notes } = req.body;

    // Check if budget exists
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    // Authorize against the budget's own trip (route middleware trusts a client-supplied id)
    if (!authorizeTrip(res, budget.trip_id, req.user.id, 'edit')) return;

    // Settlement fields (optional): payer + equal-split participants
    const settlement = resolveSettlementFields(req.body, budget.trip_id);
    if (settlement === false) {
      return res.status(400).json({ message: 'Payer and participants must be trip members' });
    }

    // Insert expense
    const insert = db.prepare(`
      INSERT INTO expenses (budget_id, name, amount, category, date, notes, paid_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(budgetId, name, amount, category, date, notes || null, settlement.paidBy);
    if (settlement.splitIds) writeSplits(result.lastInsertRowid, settlement.splitIds);

    // Get the created expense
    const [expense] = attachSplits([
      db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid)
    ]);

    // Calculate new total spent
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE budget_id = ?')
      .get(budgetId).total || 0;

    // Emit socket event for real-time updates
    emitToTrip(budget.trip_id, 'expense:created', { expense, totalSpent, budgetId });

    return res.status(201).json({
      message: 'Expense added successfully',
      expense,
      totalSpent
    });
  } catch (error) {
    console.error('Add expense error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update an expense
 */
const updateExpense = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { expenseId } = req.params;
    const { name, amount, category, date, notes } = req.body;

    // Check if expense exists
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Authorize against the expense's own trip (route middleware trusts a client-supplied id)
    if (!authorizeTrip(res, getTripIdForExpense(expense.id), req.user.id, 'edit')) return;

    // Get budget to find trip_id
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(expense.budget_id);

    // Settlement fields: absent keeps current, '' clears the payer
    let paidBy = expense.paid_by;
    if (req.body.paid_by !== undefined) {
      const settlement = resolveSettlementFields(req.body, budget.trip_id);
      if (settlement === false) {
        return res.status(400).json({ message: 'Payer and participants must be trip members' });
      }
      paidBy = settlement.paidBy;
      writeSplits(expenseId, settlement.splitIds || []);
    }

    // Update expense
    const update = db.prepare(`
      UPDATE expenses
      SET name = ?, amount = ?, category = ?, date = ?, notes = ?, paid_by = ?
      WHERE id = ?
    `);

    update.run(
      name || expense.name,
      amount || expense.amount,
      category || expense.category,
      date || expense.date,
      notes !== undefined ? notes : expense.notes,
      paidBy,
      expenseId
    );

    // Get updated expense
    const [updatedExpense] = attachSplits([
      db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId)
    ]);

    // Calculate new total spent
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE budget_id = ?')
      .get(expense.budget_id).total || 0;

    // Emit socket event for real-time updates
    if (budget) {
      emitToTrip(budget.trip_id, 'expense:updated', { expense: updatedExpense, totalSpent, budgetId: expense.budget_id });
    }

    return res.status(200).json({
      message: 'Expense updated successfully',
      expense: updatedExpense,
      totalSpent
    });
  } catch (error) {
    console.error('Update expense error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete an expense
 */
const deleteExpense = (req, res) => {
  try {
    const { expenseId } = req.params;

    // Check if expense exists
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Authorize against the expense's own trip (route middleware trusts a client-supplied id)
    if (!authorizeTrip(res, getTripIdForExpense(expense.id), req.user.id, 'edit')) return;

    const budgetId = expense.budget_id;

    // Get budget to find trip_id
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);

    // Delete expense
    db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);

    // Calculate new total spent
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE budget_id = ?')
      .get(budgetId).total || 0;

    // Emit socket event for real-time updates
    if (budget) {
      emitToTrip(budget.trip_id, 'expense:deleted', { expenseId, totalSpent, budgetId });
    }

    return res.status(200).json({
      message: 'Expense deleted successfully',
      totalSpent
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a budget and all its expenses
 */
const deleteBudget = (req, res) => {
  try {
    const { budgetId } = req.params;

    // Check if budget exists
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    // Authorize against the budget's own trip (route middleware trusts a client-supplied id)
    if (!authorizeTrip(res, budget.trip_id, req.user.id, 'edit')) return;

    // Store tripId before deletion
    const tripId = budget.trip_id;

    // Start a transaction to delete the budget and all its expenses
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Delete all expenses for this budget
      db.prepare('DELETE FROM expenses WHERE budget_id = ?').run(budgetId);

      // Delete the budget
      db.prepare('DELETE FROM budgets WHERE id = ?').run(budgetId);

      // Commit transaction
      db.prepare('COMMIT').run();

      // Emit socket event for real-time updates
      emitToTrip(tripId, 'budget:deleted', { budgetId });

      return res.status(200).json({
        message: 'Budget deleted successfully'
      });
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Delete budget error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Who-owes-whom for a trip's shared expenses. Only expenses with a payer
 * participate; each participant owes amount/participants to the payer
 * (payers in their own split consume their share naturally). Transfers are
 * reduced greedily so the group settles in few payments.
 */
const getSettlement = (req, res) => {
  try {
    const { tripId } = req.params;
    const budget = db.prepare('SELECT * FROM budgets WHERE trip_id = ?').get(tripId);
    if (!budget) {
      return res.status(200).json({ balances: [], transfers: [], currency: '$' });
    }

    const expenses = attachSplits(
      db.prepare('SELECT * FROM expenses WHERE budget_id = ? AND paid_by IS NOT NULL').all(budget.id)
    );

    const balances = new Map(); // userId -> net; positive = is owed money
    for (const e of expenses) {
      if (e.split_user_ids.length === 0) continue;
      const share = e.amount / e.split_user_ids.length;
      balances.set(e.paid_by, (balances.get(e.paid_by) || 0) + e.amount);
      for (const uid of e.split_user_ids) {
        balances.set(uid, (balances.get(uid) || 0) - share);
      }
    }

    const members = db.prepare(`
      SELECT u.id, u.name FROM trip_members tm JOIN users u ON u.id = tm.user_id WHERE tm.trip_id = ?
    `).all(tripId);
    const nameOf = new Map(members.map(m => [m.id, m.name]));

    const round2 = (n) => Math.round(n * 100) / 100;
    const balanceList = [...balances.entries()]
      .map(([user_id, net]) => ({ user_id, name: nameOf.get(user_id) || 'Former member', net: round2(net) }))
      .filter(b => Math.abs(b.net) >= 0.01)
      .sort((a, b) => b.net - a.net);

    const debtors = balanceList.filter(b => b.net < 0).map(b => ({ ...b, owes: -b.net }));
    const creditors = balanceList.filter(b => b.net > 0).map(b => ({ ...b, owed: b.net }));
    const transfers = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].owes, creditors[j].owed);
      transfers.push({
        from: debtors[i].user_id, from_name: debtors[i].name,
        to: creditors[j].user_id, to_name: creditors[j].name,
        amount: round2(pay),
      });
      debtors[i].owes -= pay;
      creditors[j].owed -= pay;
      if (debtors[i].owes < 0.01) i++;
      if (creditors[j].owed < 0.01) j++;
    }

    return res.status(200).json({
      balances: balanceList,
      transfers,
      currency: budget.currency || '$',
      currency_code: budget.currency_code || null,
    });
  } catch (error) {
    console.error('Get settlement error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTripBudget,
  getSettlement,
  createBudget,
  updateBudget,
  addExpense,
  updateExpense,
  deleteExpense,
  deleteBudget
};