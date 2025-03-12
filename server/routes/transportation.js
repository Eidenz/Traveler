// server/routes/transportation.js
const express = require('express');
const { body } = require('express-validator');
const { 
  getTripTransportation,
  getTransportation,
  createTransportation,
  updateTransportation,
  deleteTransportation
} = require('../controllers/transportationController');
const { authenticate, checkTripAccess, requireEditAccess } = require('../middleware/auth');

const router = express.Router();

// Authentication required for all transportation routes
router.use(authenticate);

// Get all transportation for a trip
router.get('/trip/:tripId', checkTripAccess(), getTripTransportation);

// Get single transportation item
router.get('/:transportId', getTransportation);

// Create a new transportation item
router.post(
  '/trip/:tripId',
  requireEditAccess,
  [
    body('type').not().isEmpty().withMessage('Transportation type is required'),
    body('from_location').not().isEmpty().withMessage('From location is required'),
    body('to_location').not().isEmpty().withMessage('To location is required'),
    body('departure_date').not().isEmpty().withMessage('Departure date is required')
  ],
  createTransportation
);

// Update a transportation item
router.put(
  '/:transportId',
  requireEditAccess,
  [
    body('type').not().isEmpty().withMessage('Transportation type is required'),
    body('from_location').not().isEmpty().withMessage('From location is required'),
    body('to_location').not().isEmpty().withMessage('To location is required'),
    body('departure_date').not().isEmpty().withMessage('Departure date is required')
  ],
  updateTransportation
);

// Delete a transportation item
router.delete('/:transportId', requireEditAccess, deleteTransportation);

module.exports = router;