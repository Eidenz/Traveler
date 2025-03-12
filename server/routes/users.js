// server/routes/users.js
const express = require('express');
const { body } = require('express-validator');
const { db } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const upload = require('../utils/fileUpload');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Authentication required for all user routes
router.use(authenticate);

// Get user profile
router.get('/profile', (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user without password
    const user = db.prepare('SELECT id, name, email, profile_image, created_at FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put(
  '/profile',
  upload.single('profile_image'),
  [
    body('name').not().isEmpty().withMessage('Name is required')
  ],
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { name } = req.body;
      
      // Get current user
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Handle profile image
      let profileImage = user.profile_image;
      if (req.file) {
        // Delete old image if exists
        if (user.profile_image) {
          const oldImagePath = path.join(__dirname, '..', user.profile_image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        profileImage = `/uploads/profiles/${req.file.filename}`;
      }
      
      // Update user
      db.prepare('UPDATE users SET name = ?, profile_image = ? WHERE id = ?')
        .run(name, profileImage, userId);
      
      // Get updated user
      const updatedUser = db.prepare('SELECT id, name, email, profile_image, created_at FROM users WHERE id = ?').get(userId);
      
      return res.status(200).json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// Change password
router.put(
  '/password',
  [
    body('current_password').not().isEmpty().withMessage('Current password is required'),
    body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { current_password, new_password } = req.body;
      
      // Get user
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check current password
      const isMatch = await bcrypt.compare(current_password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(new_password, salt);
      
      // Update password
      db.prepare('UPDATE users SET password = ? WHERE id = ?')
        .run(hashedPassword, userId);
      
      return res.status(200).json({
        message: 'Password updated successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// Search users (for sharing trips)
router.get('/search', (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 3) {
      return res.status(400).json({ message: 'Search query must be at least 3 characters' });
    }
    
    // Search users by name or email
    const users = db.prepare(`
      SELECT id, name, email, profile_image
      FROM users
      WHERE (name LIKE ? OR email LIKE ?)
      AND id != ?
      LIMIT 10
    `).all(`%${query}%`, `%${query}%`, req.user.id);
    
    return res.status(200).json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;