// server/routes/budgets.js

const express = require('express');
const { body } = require('express-validator');
const { 
  getTripBudget,
  createBudget,
  updateBudget,
  addExpense,
  updateExpense,
  deleteExpense,
  deleteBudget
} = require('../controllers/budgetController');
const { authenticate, checkTripAccess, requireEditAccess } = require('../middleware/auth');

const router = express.Router();

// Authentication required for all budget routes
router.use(authenticate);

// Get budget for a trip
router.get('/trip/:tripId', checkTripAccess(), getTripBudget);

// Create a budget for a trip
router.post(
  '/trip/:tripId',
  requireEditAccess,
  [
    body('total_amount').isNumeric().withMessage('Total amount must be a number'),
    body('currency').optional().isString().withMessage('Currency must be a string')
  ],
  createBudget
);

// Update a budget
router.put(
  '/:budgetId',
  requireEditAccess,
  [
    body('total_amount').isNumeric().withMessage('Total amount must be a number'),
    body('currency').optional().isString().withMessage('Currency must be a string')
  ],
  updateBudget
);

// Add an expense to a budget
router.post(
  '/:budgetId/expenses',
  requireEditAccess,
  [
    body('name').not().isEmpty().withMessage('Expense name is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('category').isIn(['transport', 'lodging', 'activities', 'food', 'other']).withMessage('Invalid category'),
    body('date').not().isEmpty().withMessage('Date is required')
  ],
  addExpense
);

// Update an expense
router.put(
  '/expenses/:expenseId',
  requireEditAccess,
  [
    body('name').optional().not().isEmpty().withMessage('Expense name is required'),
    body('amount').optional().isNumeric().withMessage('Amount must be a number'),
    body('category').optional().isIn(['transport', 'lodging', 'activities', 'food', 'other']).withMessage('Invalid category'),
    body('date').optional().not().isEmpty().withMessage('Date is required')
  ],
  updateExpense
);

// Delete an expense
router.delete('/expenses/:expenseId', requireEditAccess, deleteExpense);

// Delete a budget
router.delete('/:budgetId', requireEditAccess, deleteBudget);

module.exports = router;