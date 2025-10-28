// server/routes/personalBudgets.js
const express = require('express');
const { body } = require('express-validator');
const {
  getPersonalBudget,
  createPersonalBudget,
  updatePersonalBudget,
  addPersonalExpense,
  updatePersonalExpense,
  deletePersonalExpense,
  deletePersonalBudget
} = require('../controllers/personalBudgetController');
const { authenticate, checkTripAccess } = require('../middleware/auth');

const router = express.Router();

// All personal budget routes require authentication
router.use(authenticate);

// Get personal budget for a trip
router.get('/trip/:tripId', checkTripAccess(), getPersonalBudget);

// Create a personal budget for a trip (user must be a member of the trip)
router.post(
  '/trip/:tripId',
  checkTripAccess(),
  [
    body('total_amount').isNumeric().withMessage('Total amount must be a number'),
    body('currency').optional().isString().withMessage('Currency must be a string')
  ],
  createPersonalBudget
);

// Update a personal budget (user must own the budget)
router.put(
  '/:budgetId',
  [
    body('total_amount').isNumeric().withMessage('Total amount must be a number'),
    body('currency').optional().isString().withMessage('Currency must be a string')
  ],
  updatePersonalBudget
);

// Add an expense to a personal budget
router.post(
  '/:budgetId/expenses',
  [
    body('name').not().isEmpty().withMessage('Expense name is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('category').isIn(['transport', 'lodging', 'activities', 'food', 'other']).withMessage('Invalid category'),
    body('date').not().isEmpty().withMessage('Date is required')
  ],
  addPersonalExpense
);

// Update a personal expense
router.put(
  '/expenses/:expenseId',
  [
    body('name').optional().not().isEmpty().withMessage('Expense name is required'),
    body('amount').optional().isNumeric().withMessage('Amount must be a number'),
    body('category').optional().isIn(['transport', 'lodging', 'activities', 'food', 'other']).withMessage('Invalid category'),
    body('date').optional().not().isEmpty().withMessage('Date is required')
  ],
  updatePersonalExpense
);

// Delete a personal expense
router.delete('/expenses/:expenseId', deletePersonalExpense);

// Delete a personal budget
router.delete('/:budgetId', deletePersonalBudget);

module.exports = router;