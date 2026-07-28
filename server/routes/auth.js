// server/routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  refreshToken
} = require('../controllers/authController');
const { authenticate, requireSessionAuth } = require('../middleware/auth');
const {
  authLimiter,
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter
} = require('../middleware/rateLimit');

const router = express.Router();

// Broad limit across all auth endpoints; individual routes add tighter limits below
router.use(authLimiter);

// Register user
router.post(
  '/register',
  registerLimiter,
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
  loginLimiter,
  [
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').exists().withMessage('Password is required')
  ],
  login
);

// Get current user
router.get('/me', authenticate, getCurrentUser);

// Exchange a valid session token for a fresh one (sliding session).
// JWT-only: an API key must never be able to mint a session token.
router.post('/refresh', authenticate, requireSessionAuth, refreshToken);

// Forgot password
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().withMessage('Please include a valid email')],
  forgotPassword
);

// Reset password
router.post(
  '/reset-password/:token',
  resetPasswordLimiter,
  [
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirm_password').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
  ],
  resetPassword
);

module.exports = router;