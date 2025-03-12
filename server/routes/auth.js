// server/routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const { register, login, getCurrentUser } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Register user
router.post(
  '/register',
  [
    body('name').not().isEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  register
);

// Login user
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').exists().withMessage('Password is required')
  ],
  login
);

// Get current user
router.get('/me', authenticate, getCurrentUser);

module.exports = router;