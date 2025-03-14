// server/routes/checklists.js

const express = require('express');
const { body } = require('express-validator');
const { 
  getTripChecklists,
  getChecklist,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  updateUserItemStatus
} = require('../controllers/checklistController');
const { authenticate, checkTripAccess, requireEditAccess } = require('../middleware/auth');

const router = express.Router();

// Authentication required for all checklist routes
router.use(authenticate);

// Trip-level checklist endpoints
router.get('/trip/:tripId', checkTripAccess(), getTripChecklists);
router.post(
  '/trip/:tripId', 
  requireEditAccess,
  [body('name').not().isEmpty().withMessage('Checklist name is required')],
  createChecklist
);

// Checklist-level endpoints
router.get('/:checklistId', getChecklist);
router.put(
  '/:checklistId',
  requireEditAccess,
  [body('name').not().isEmpty().withMessage('Checklist name is required')],
  updateChecklist
);
router.delete('/:checklistId', requireEditAccess, deleteChecklist);

// Checklist item endpoints
router.post(
  '/:checklistId/items',
  requireEditAccess,
  [body('description').not().isEmpty().withMessage('Item description is required')],
  createChecklistItem
);
router.put(
  '/items/:itemId',
  requireEditAccess,
  [body('description').not().isEmpty().withMessage('Item description is required')],
  updateChecklistItem
);

router.patch(
  '/items/:itemId/user-status',
  checkTripAccess(), // Allow all members to update their own status
  [body('status').isIn(['checked', 'skipped', 'pending']).withMessage('Invalid status')],
  updateUserItemStatus
);

router.delete('/items/:itemId', requireEditAccess, deleteChecklistItem);

module.exports = router;