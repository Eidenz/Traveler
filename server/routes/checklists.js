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
const { authenticate, checkTripAccess } = require('../middleware/auth');

const router = express.Router();

// Authentication required for all checklist routes
router.use(authenticate);

// Trip-level checklist endpoints
router.get('/trip/:tripId', checkTripAccess(), getTripChecklists);
router.post(
  '/trip/:tripId',
  // Any member can create a personal checklist; the controller requires
  // edit access for shared ones
  checkTripAccess(),
  [body('name').not().isEmpty().withMessage('Checklist name is required')],
  createChecklist
);

// Checklist-level endpoints
// Mutations only require trip membership here; the controller enforces
// edit access for shared checklists and creator-only for personal ones
router.get('/:checklistId', checkTripAccess(), getChecklist);
router.put(
  '/:checklistId',
  checkTripAccess(),
  [body('name').not().isEmpty().withMessage('Checklist name is required')],
  updateChecklist
);
router.delete('/:checklistId', checkTripAccess(), deleteChecklist);

// Checklist item endpoints
router.post(
  '/:checklistId/items',
  checkTripAccess(),
  [body('description').not().isEmpty().withMessage('Item description is required')],
  createChecklistItem
);
router.put(
  '/items/:itemId',
  checkTripAccess(),
  [body('description').not().isEmpty().withMessage('Item description is required')],
  updateChecklistItem
);

router.patch(
  '/items/:itemId/user-status',
  checkTripAccess(), // Allow all members to update their own status
  [body('status').isIn(['checked', 'skipped', 'pending']).withMessage('Invalid status')],
  updateUserItemStatus
);

router.delete('/items/:itemId', checkTripAccess(), deleteChecklistItem);

module.exports = router;