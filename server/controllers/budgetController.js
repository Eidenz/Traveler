// server/controllers/budgetController.js

const { db } = require('../db/database');
const { validationResult } = require('express-validator');

/**
 * Get a budget for a trip
 */
const getTripBudget = (req, res) => {
  try {
    const { tripId } = req.params;
    
    // Get budget
    const budget = db.prepare('SELECT * FROM budgets WHERE trip_id = ?').get(tripId);
    
    // If no budget exists, return null
    if (!budget) {
      return res.status(200).json({ budget: null, expenses: [] });
    }
    
    // Get expenses
    const expenses = db.prepare('SELECT * FROM expenses WHERE budget_id = ? ORDER BY date DESC').all(budget.id);
    
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
      totalSpent
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
    const { total_amount, currency } = req.body;
    
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
      INSERT INTO budgets (trip_id, total_amount, currency)
      VALUES (?, ?, ?)
    `);
    
    const result = insert.run(tripId, total_amount, currency || '$');
    
    // Get the created budget
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(result.lastInsertRowid);
    
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
    const { total_amount, currency } = req.body;
    
    // Check if budget exists
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    
    // Update budget
    const update = db.prepare(`
      UPDATE budgets
      SET total_amount = ?, currency = ?
      WHERE id = ?
    `);
    
    update.run(total_amount, currency || budget.currency, budgetId);
    
    // Get updated budget
    const updatedBudget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    
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
    
    // Insert expense
    const insert = db.prepare(`
      INSERT INTO expenses (budget_id, name, amount, category, date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = insert.run(budgetId, name, amount, category, date, notes || null);
    
    // Get the created expense
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    
    // Calculate new total spent
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE budget_id = ?')
      .get(budgetId).total || 0;
    
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
    
    // Update expense
    const update = db.prepare(`
      UPDATE expenses
      SET name = ?, amount = ?, category = ?, date = ?, notes = ?
      WHERE id = ?
    `);
    
    update.run(
      name || expense.name, 
      amount || expense.amount, 
      category || expense.category, 
      date || expense.date, 
      notes !== undefined ? notes : expense.notes, 
      expenseId
    );
    
    // Get updated expense
    const updatedExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
    
    // Calculate new total spent
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE budget_id = ?')
      .get(expense.budget_id).total || 0;
    
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
    
    const budgetId = expense.budget_id;
    
    // Delete expense
    db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);
    
    // Calculate new total spent
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE budget_id = ?')
      .get(budgetId).total || 0;
    
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
    
    // Start a transaction to delete the budget and all its expenses
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      // Delete all expenses for this budget
      db.prepare('DELETE FROM expenses WHERE budget_id = ?').run(budgetId);
      
      // Delete the budget
      db.prepare('DELETE FROM budgets WHERE id = ?').run(budgetId);
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
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

module.exports = {
  getTripBudget,
  createBudget,
  updateBudget,
  addExpense,
  updateExpense,
  deleteExpense,
  deleteBudget
};