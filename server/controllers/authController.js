// server/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../db/database');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../utils/emailService'); // Added

/**
 * Register a new user
 */
const register = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user into database
    // Default receiveEmails is 1 (true) as set in the schema
    const insert = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
    const result = insert.run(name, email, hashedPassword);

    // Create JWT token
    const token = jwt.sign(
      { userId: result.lastInsertRowid },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Get user info including receiveEmails
    const user = db.prepare('SELECT id, name, email, receiveEmails FROM users WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

/**
 * Login a user
 */
const login = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user info without password or reset token info
    const { password: pass, resetPasswordToken, resetPasswordExpires, ...userInfo } = user;

    return res.status(200).json({
      message: 'Login successful',
      user: userInfo,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
};

/**
 * Get current user profile
 */
const getCurrentUser = (req, res) => {
  try {
    // Return user info without password or reset token info
    const { password, resetPasswordToken, resetPasswordExpires, ...userInfo } = req.user;
    return res.status(200).json({
      user: userInfo
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Handle forgot password request
 */
const forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      // Don't reveal if user exists or not
      return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set token expiry (1 hour from now)
    const expires = Date.now() + 3600000; // 1 hour in milliseconds

    // Save token and expiry to user record
    db.prepare('UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?')
      .run(hashedToken, expires, user.id);

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send email
    const emailData = {
      userName: user.name,
      userEmail: user.email,
      resetLink: resetUrl,
      privacyLink: `${process.env.FRONTEND_URL}/privacy`, // Replace with actual link
      termsLink: `${process.env.FRONTEND_URL}/terms`, // Replace with actual link
      unsubscribeLink: `${process.env.FRONTEND_URL}/unsubscribe`, // Replace with actual link
      facebookLink: 'https://facebook.com', // Replace with actual link
      twitterLink: 'https://twitter.com', // Replace with actual link
      instagramLink: 'https://instagram.com' // Replace with actual link
    };

    sendEmail(
      user.email,
      'Reset Your Traveler Password',
      'password-reset-template',
      emailData
    );

    return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    // Clear token fields in case of error during email sending etc.
    // db.prepare('UPDATE users SET resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?').run(req.body.email); // Optional: Decide if needed
    return res.status(500).json({ message: 'Server error during password reset request' });
  }
};

/**
 * Handle reset password action
 */
const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get hashed token from URL params
    const resetToken = req.params.token;
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Find user by token and check expiry
    const user = db.prepare('SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?')
      .get(hashedToken, Date.now());

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    // Hash new password
    const { password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear reset token fields
    db.prepare('UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?')
      .run(hashedPassword, user.id);

    // Optionally, log the user in or just send success message
    // Create JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

     // Return user info without password or reset token info
    const { password: pass, resetPasswordToken: rpt, resetPasswordExpires: rpe, ...userInfo } = user;
    userInfo.password = hashedPassword; // Update password in returned user info

    return res.status(200).json({
      message: 'Password reset successfully.',
      user: userInfo,
      token: token // Send new token for immediate login
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error during password reset' });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword
};