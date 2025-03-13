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

router.delete(
  '/account',
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: 'Password is required for account deletion' });
      }
      
      // Get user
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect password' });
      }
      
      // Start a transaction to delete all user data
      db.prepare('BEGIN TRANSACTION').run();
      
      try {
        // Get all trips where user is owner
        const ownedTrips = db.prepare('SELECT id FROM trips WHERE owner_id = ?').all(userId);
        
        // For each owned trip
        for (const trip of ownedTrips) {
          // Get all documents related to this trip
          const tripDocuments = db.prepare(`
            SELECT d.file_path FROM documents d
            WHERE (d.reference_type = 'trip' AND d.reference_id = ?) OR
                  (d.reference_type = 'transportation' AND d.reference_id IN 
                    (SELECT id FROM transportation WHERE trip_id = ?)) OR
                  (d.reference_type = 'lodging' AND d.reference_id IN 
                    (SELECT id FROM lodging WHERE trip_id = ?)) OR
                  (d.reference_type = 'activity' AND d.reference_id IN 
                    (SELECT id FROM activities WHERE trip_id = ?))
          `).all(trip.id, trip.id, trip.id, trip.id);
          
          // Delete document files
          for (const doc of tripDocuments) {
            try {
              const filePath = path.join(__dirname, '..', doc.file_path);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            } catch (err) {
              console.error(`Error deleting file: ${doc.file_path}`, err);
              // Continue deletion process
            }
          }
        }
        
        // Delete all trip_members entries for this user (both owned and shared)
        db.prepare('DELETE FROM trip_members WHERE user_id = ?').run(userId);
        
        // Delete owned trips (will cascade delete related entities)
        db.prepare('DELETE FROM trips WHERE owner_id = ?').run(userId);
        
        // Delete all documents uploaded by this user that aren't deleted by cascade
        const remainingDocs = db.prepare('SELECT file_path FROM documents WHERE uploaded_by = ?').all(userId);
        
        // Delete document files
        for (const doc of remainingDocs) {
          try {
            const filePath = path.join(__dirname, '..', doc.file_path);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            console.error(`Error deleting file: ${doc.file_path}`, err);
            // Continue deletion process
          }
        }
        
        // Delete documents in the database
        db.prepare('DELETE FROM documents WHERE uploaded_by = ?').run(userId);
        
        // Delete profile image if it exists
        if (user.profile_image) {
          try {
            const imagePath = path.join(__dirname, '..', user.profile_image);
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath);
            }
          } catch (err) {
            console.error(`Error deleting profile image: ${user.profile_image}`, err);
            // Continue deletion process
          }
        }
        
        // Finally delete the user
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        
        // Commit transaction
        db.prepare('COMMIT').run();
        
        return res.status(200).json({ message: 'Account deleted successfully' });
      } catch (error) {
        // Rollback on error
        db.prepare('ROLLBACK').run();
        console.error('Transaction error during account deletion:', error);
        return res.status(500).json({ message: 'Error during account deletion process' });
      }
    } catch (error) {
      console.error('Account deletion error:', error);
      return res.status(500).json({ message: 'Server error during account deletion' });
    }
  }
);

module.exports = router;