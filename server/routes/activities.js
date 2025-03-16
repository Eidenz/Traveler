// server/routes/activities.js
const express = require('express');
const { body } = require('express-validator');
const { 
  getTripActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity
} = require('../controllers/activityController');
const { authenticate, checkTripAccess, requireEditAccess } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

const router = express.Router();

// Authentication required for all activity routes
router.use(authenticate);

// Get all activities for a trip
router.get('/trip/:tripId', checkTripAccess(), getTripActivities);

// Get single activity
router.get('/:activityId', getActivity);

// Create a new activity
router.post(
  '/trip/:tripId',
  requireEditAccess,
  upload.single('banner_image'),  // Add file upload middleware
  [
    body('name').not().isEmpty().withMessage('Activity name is required'),
    body('date').not().isEmpty().withMessage('Activity date is required')
  ],
  createActivity
);

// Update an activity
router.put(
  '/:activityId',
  requireEditAccess,
  upload.single('banner_image'),  // Add file upload middleware
  [
    body('name').not().isEmpty().withMessage('Activity name is required'),
    body('date').not().isEmpty().withMessage('Activity date is required')
  ],
  updateActivity
);

// Delete an activity
router.delete('/:activityId', requireEditAccess, deleteActivity);

module.exports = router;