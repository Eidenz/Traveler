// server/routes/lodging.js
const express = require('express');
const { body } = require('express-validator');
const { 
  getTripLodging,
  getLodging,
  createLodging,
  updateLodging,
  deleteLodging
} = require('../controllers/lodgingController');
const { authenticate, checkTripAccess, requireEditAccess } = require('../middleware/auth');

const router = express.Router();

// Authentication required for all lodging routes
router.use(authenticate);

// Get all lodging for a trip
router.get('/trip/:tripId', checkTripAccess(), getTripLodging);

// Get single lodging item
router.get('/:lodgingId', getLodging);

// Create a new lodging item
router.post(
  '/trip/:tripId',
  requireEditAccess,
  [
    body('name').not().isEmpty().withMessage('Lodging name is required'),
    body('check_in').not().isEmpty().withMessage('Check-in date is required'),
    body('check_out').not().isEmpty().withMessage('Check-out date is required')
  ],
  createLodging
);

// Update a lodging item
router.put(
  '/:lodgingId',
  requireEditAccess,
  [
    body('name').not().isEmpty().withMessage('Lodging name is required'),
    body('check_in').not().isEmpty().withMessage('Check-in date is required'),
    body('check_out').not().isEmpty().withMessage('Check-out date is required')
  ],
  updateLodging
);

// Delete a lodging item
router.delete('/:lodgingId', requireEditAccess, deleteLodging);

module.exports = router;