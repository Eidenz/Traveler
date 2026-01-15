// server/routes/trips.js
const express = require('express');
const { body } = require('express-validator');
const {
  getUserTrips,
  getTripById,
  createTrip,
  updateTrip,
  deleteTrip,
  shareTrip,
  removeTripMember,
  updateMemberRole,
  generatePublicShareToken,
  revokePublicShareToken,
  getTripByPublicToken
} = require('../controllers/tripController');
const { getAllTripDocuments } = require('../controllers/documentController');
const { authenticate, checkTripAccess, requireEditAccess, requireOwnerAccess } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

const router = express.Router();

// Public route - Get trip by public share token (no auth required)
router.get('/public/:token', getTripByPublicToken);

// Authentication required for all other trip routes
router.use(authenticate);

// Get user's trips
router.get('/', getUserTrips);

// Get single trip by ID
router.get('/:tripId', checkTripAccess(), getTripById);

// Get all documents for a trip
router.get('/:tripId/documents', checkTripAccess(), getAllTripDocuments);

// Create a new trip
router.post(
  '/',
  upload.single('cover_image'),
  [
    body('name').not().isEmpty().withMessage('Trip name is required'),
    body('start_date').not().isEmpty().withMessage('Start date is required'),
    body('end_date').not().isEmpty().withMessage('End date is required')
  ],
  createTrip
);

// Update a trip
router.put(
  '/:tripId',
  requireEditAccess,
  upload.single('cover_image'),
  [
    body('name').not().isEmpty().withMessage('Trip name is required'),
    body('start_date').not().isEmpty().withMessage('Start date is required'),
    body('end_date').not().isEmpty().withMessage('End date is required')
  ],
  updateTrip
);

// Delete a trip
router.delete('/:tripId', requireOwnerAccess, deleteTrip);

// Share a trip with another user
router.post(
  '/:tripId/share',
  requireOwnerAccess,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['editor', 'viewer']).withMessage('Role must be editor or viewer')
  ],
  shareTrip
);

// Remove a user from a trip
router.delete('/:tripId/members/:userId', requireOwnerAccess, removeTripMember);

// Update a member's role
router.put(
  '/:tripId/members/:userId/role',
  requireOwnerAccess,
  [
    body('role').isIn(['editor', 'viewer']).withMessage('Role must be editor or viewer')
  ],
  updateMemberRole
);

// Generate public share token (owner only)
router.post('/:tripId/public-share', requireOwnerAccess, generatePublicShareToken);

// Revoke public share token (owner only)
router.delete('/:tripId/public-share', requireOwnerAccess, revokePublicShareToken);

module.exports = router;
