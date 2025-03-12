// server/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { validationResult } = require('express-validator');

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
    const insert = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
    const result = insert.run(name, email, hashedPassword);

    // Create JWT token
    const token = jwt.sign(
      { userId: result.lastInsertRowid },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Get user info
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(result.lastInsertRowid);

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

    // Return user info without password
    const { password: pass, ...userInfo } = user;

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
    return res.status(200).json({
      user: req.user
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser
};