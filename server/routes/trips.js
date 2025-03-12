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
  removeTripMember
} = require('../controllers/tripController');
const { authenticate, checkTripAccess, requireEditAccess, requireOwnerAccess } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

const router = express.Router();

// Authentication required for all trip routes
router.use(authenticate);

// Get user's trips
router.get('/', getUserTrips);

// Get single trip by ID
router.get('/:tripId', checkTripAccess(), getTripById);

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

module.exports = router;