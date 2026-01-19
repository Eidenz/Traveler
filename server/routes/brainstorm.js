// server/routes/brainstorm.js
const express = require('express');
const {
    getBrainstormItems,
    getBrainstormItem,
    createBrainstormItem,
    updateBrainstormItem,
    updateItemPosition,
    batchUpdatePositions,
    deleteBrainstormItem,
    getPublicBrainstormItems,
    getBrainstormGroups,
    createBrainstormGroup,
    updateBrainstormGroup,
    deleteBrainstormGroup
} = require('../controllers/brainstormController');
const { authenticate, checkTripAccess, requireEditAccess } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

const router = express.Router();

// Public route - Get brainstorm items by public share token (no auth required)
router.get('/public/:token', getPublicBrainstormItems);

// Authentication required for all other routes
router.use(authenticate);

// Get all brainstorm items for a trip
router.get('/trip/:tripId', checkTripAccess(), getBrainstormItems);

// Get single brainstorm item
router.get('/:itemId', getBrainstormItem);

// Create a new brainstorm item
router.post(
    '/trip/:tripId',
    requireEditAccess,
    upload.single('image'),
    createBrainstormItem
);

// Update a brainstorm item
router.put(
    '/:itemId',
    upload.single('image'),
    updateBrainstormItem
);

// Update item position (for drag and drop)
router.patch('/:itemId/position', updateItemPosition);

// Batch update positions
router.patch('/batch/positions', batchUpdatePositions);

// Delete a brainstorm item
router.delete('/:itemId', deleteBrainstormItem);

// --- Groups Routes ---

// Get all brainstorm groups for a trip
router.get('/trip/:tripId/groups', checkTripAccess(), getBrainstormGroups);

// Create a new brainstorm group
router.post('/trip/:tripId/groups', requireEditAccess, createBrainstormGroup);

// Update a brainstorm group
router.put('/groups/:groupId', updateBrainstormGroup);

// Delete a brainstorm group
router.delete('/groups/:groupId', deleteBrainstormGroup);

module.exports = router;
