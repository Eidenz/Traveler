// server/controllers/personalBudgetController.js
const { db } = require('../db/database');
const { validationResult } = require('express-validator');

/**
 * Get the personal budget for a user on a trip
 */
const getPersonalBudget = (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    // Get personal budget for the user on this trip
    const budget = db.prepare('SELECT * FROM personal_budgets WHERE trip_id = ? AND user_id = ?').get(tripId, userId);
    
    if (!budget) {
      return res.status(200).json({ budget: null, expenses: [] });
    }

    const expenses = db.prepare('SELECT * FROM personal_expenses WHERE personal_budget_id = ? ORDER BY date DESC').all(budget.id);

    const categoryTotals = {};
    const categories = ['transport', 'lodging', 'activities', 'food', 'other'];
    categories.forEach(category => {
      const total = db.prepare('SELECT SUM(amount) as total FROM personal_expenses WHERE personal_budget_id = ? AND category = ?').get(budget.id, category);
      categoryTotals[category] = total.total || 0;
    });
    
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM personal_expenses WHERE personal_budget_id = ?').get(budget.id).total || 0;

    return res.status(200).json({ budget, expenses, categoryTotals, totalSpent });
  } catch (error) {
    console.error('Get personal budget error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create a personal budget
 */
const createPersonalBudget = (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tripId } = req.params;
    const userId = req.user.id;
    const { total_amount, currency } = req.body;
    
    const existingBudget = db.prepare('SELECT * FROM personal_budgets WHERE trip_id = ? AND user_id = ?').get(tripId, userId);
    if (existingBudget) {
      return res.status(400).json({ message: 'Personal budget already exists for this trip' });
    }
    
    const result = db.prepare('INSERT INTO personal_budgets (trip_id, user_id, total_amount, currency) VALUES (?, ?, ?, ?)').run(tripId, userId, total_amount, currency || '$');
    const budget = db.prepare('SELECT * FROM personal_budgets WHERE id = ?').get(result.lastInsertRowid);
    
    return res.status(201).json({ message: 'Personal budget created successfully', budget });
  } catch (error)
  {
    console.error('Create personal budget error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a personal budget
 */
const updatePersonalBudget = (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { budgetId } = req.params;
    const userId = req.user.id;
    const { total_amount, currency } = req.body;
    
    const budget = db.prepare('SELECT * FROM personal_budgets WHERE id = ? AND user_id = ?').get(budgetId, userId);
    if (!budget) {
      return res.status(403).json({ message: 'Access denied or budget not found' });
    }
    
    db.prepare('UPDATE personal_budgets SET total_amount = ?, currency = ? WHERE id = ?').run(total_amount, currency || budget.currency, budgetId);
    const updatedBudget = db.prepare('SELECT * FROM personal_budgets WHERE id = ?').get(budgetId);
    
    return res.status(200).json({ message: 'Personal budget updated successfully', budget: updatedBudget });
  } catch (error) {
    console.error('Update personal budget error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Add a personal expense
 */
const addPersonalExpense = (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { budgetId } = req.params;
    const userId = req.user.id;
    const { name, amount, category, date, notes } = req.body;
    
    const budget = db.prepare('SELECT * FROM personal_budgets WHERE id = ? AND user_id = ?').get(budgetId, userId);
    if (!budget) {
      return res.status(403).json({ message: 'Access denied or budget not found' });
    }
    
    const result = db.prepare('INSERT INTO personal_expenses (personal_budget_id, name, amount, category, date, notes) VALUES (?, ?, ?, ?, ?, ?)').run(budgetId, name, amount, category, date, notes || null);
    const expense = db.prepare('SELECT * FROM personal_expenses WHERE id = ?').get(result.lastInsertRowid);
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM personal_expenses WHERE personal_budget_id = ?').get(budgetId).total || 0;
    
    return res.status(201).json({ message: 'Expense added successfully', expense, totalSpent });
  } catch (error) {
    console.error('Add personal expense error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a personal expense
 */
const updatePersonalExpense = (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { expenseId } = req.params;
    const userId = req.user.id;
    const { name, amount, category, date, notes } = req.body;
    
    const expense = db.prepare(`
      SELECT pe.* FROM personal_expenses pe
      JOIN personal_budgets pb ON pe.personal_budget_id = pb.id
      WHERE pe.id = ? AND pb.user_id = ?
    `).get(expenseId, userId);

    if (!expense) {
      return res.status(403).json({ message: 'Access denied or expense not found' });
    }
    
    db.prepare('UPDATE personal_expenses SET name = ?, amount = ?, category = ?, date = ?, notes = ? WHERE id = ?').run(name || expense.name, amount || expense.amount, category || expense.category, date || expense.date, notes !== undefined ? notes : expense.notes, expenseId);
    const updatedExpense = db.prepare('SELECT * FROM personal_expenses WHERE id = ?').get(expenseId);
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM personal_expenses WHERE personal_budget_id = ?').get(expense.personal_budget_id).total || 0;
    
    return res.status(200).json({ message: 'Expense updated successfully', expense: updatedExpense, totalSpent });
  } catch (error) {
    console.error('Update personal expense error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a personal expense
 */
const deletePersonalExpense = (req, res) => {
  try {
    const { expenseId } = req.params;
    const userId = req.user.id;

    const expense = db.prepare(`
      SELECT pe.* FROM personal_expenses pe
      JOIN personal_budgets pb ON pe.personal_budget_id = pb.id
      WHERE pe.id = ? AND pb.user_id = ?
    `).get(expenseId, userId);

    if (!expense) {
      return res.status(403).json({ message: 'Access denied or expense not found' });
    }
    
    const budgetId = expense.personal_budget_id;
    db.prepare('DELETE FROM personal_expenses WHERE id = ?').run(expenseId);
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM personal_expenses WHERE personal_budget_id = ?').get(budgetId).total || 0;
    
    return res.status(200).json({ message: 'Expense deleted successfully', totalSpent });
  } catch (error) {
    console.error('Delete personal expense error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a personal budget
 */
const deletePersonalBudget = (req, res) => {
  try {
    const { budgetId } = req.params;
    const userId = req.user.id;

    const budget = db.prepare('SELECT * FROM personal_budgets WHERE id = ? AND user_id = ?').get(budgetId, userId);
    if (!budget) {
      return res.status(403).json({ message: 'Access denied or budget not found' });
    }
    
    db.prepare('BEGIN TRANSACTION').run();
    try {
      db.prepare('DELETE FROM personal_expenses WHERE personal_budget_id = ?').run(budgetId);
      db.prepare('DELETE FROM personal_budgets WHERE id = ?').run(budgetId);
      db.prepare('COMMIT').run();
      return res.status(200).json({ message: 'Personal budget deleted successfully' });
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Delete personal budget error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPersonalBudget,
  createPersonalBudget,
  updatePersonalBudget,
  addPersonalExpense,
  updatePersonalExpense,
  deletePersonalExpense,
  deletePersonalBudget
};