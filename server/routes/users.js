// server/routes/users.js
const express = require('express');
const { body, validationResult } = require('express-validator'); // Import validationResult here
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

    // Get user without password, include receiveEmails
    const user = db.prepare('SELECT id, name, email, profile_image, receiveEmails, created_at FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert receiveEmails to boolean for frontend
    user.receiveEmails = !!user.receiveEmails;

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
  [ // Keep validations here
    body('name').not().isEmpty().withMessage('Name is required'),
    body('receiveEmails').optional().isBoolean().withMessage('Email preference must be true or false')
  ],
  async (req, res) => {
    // Input validation - Moved inside the handler
     const errors = validationResult(req); // Use the imported function
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.id;
      const { name, receiveEmails } = req.body;

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
          try {
              const oldImagePath = path.join(__dirname, '..', user.profile_image);
              if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
              }
          } catch(err) {
              console.error("Error deleting old profile image:", err);
          }
        }
        profileImage = `/uploads/profiles/${req.file.filename}`;
      } else if (req.body.remove_profile_image === 'true') {
         if (user.profile_image) {
            try {
                const oldImagePath = path.join(__dirname, '..', user.profile_image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            } catch(err) {
                console.error("Error deleting profile image:", err);
            }
         }
         profileImage = null;
      }


      // Convert receiveEmails boolean to integer (1 or 0) for DB
      const receiveEmailsValue = receiveEmails !== undefined
        ? (receiveEmails === 'true' || receiveEmails === true ? 1 : 0)
        : user.receiveEmails;

      // Update user name, image, and email preference
      db.prepare('UPDATE users SET name = ?, profile_image = ?, receiveEmails = ? WHERE id = ?')
        .run(name, profileImage, receiveEmailsValue, userId);

      // Get updated user
      const updatedUserResult = db.prepare('SELECT id, name, email, profile_image, receiveEmails, created_at FROM users WHERE id = ?').get(userId);
      updatedUserResult.receiveEmails = !!updatedUserResult.receiveEmails; // Convert back to boolean

      return res.status(200).json({
        message: 'Profile updated successfully',
        user: updatedUserResult
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
  [ // Keep validations here
    body('current_password').not().isEmpty().withMessage('Current password is required'),
    body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
     // Input validation - Moved inside the handler
     const errors = validationResult(req); // Use the imported function
     if (!errors.isEmpty()) {
       return res.status(400).json({ errors: errors.array() });
     }

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

// Delete Account
router.delete(
  '/account',
   [ // Keep validation here
    body('password').not().isEmpty().withMessage('Password is required for account deletion')
  ],
  async (req, res) => {
     // Input validation - Moved inside the handler
     const errors = validationResult(req); // Use the imported function
     if (!errors.isEmpty()) {
       return res.status(400).json({ errors: errors.array() });
     }

    try {
      const userId = req.user.id;
      const { password } = req.body;

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

        // For each owned trip, delete associated files (documents, banners)
        for (const trip of ownedTrips) {
          // Documents
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

          tripDocuments.forEach(doc => {
              try {
                const filePath = path.join(__dirname, '..', doc.file_path);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              } catch(err){ console.error(`Error deleting file: ${doc.file_path}`, err); }
          });

           // Banner images for related items
          const transportBanners = db.prepare('SELECT banner_image FROM transportation WHERE trip_id = ? AND banner_image IS NOT NULL').all(trip.id);
          const lodgingBanners = db.prepare('SELECT banner_image FROM lodging WHERE trip_id = ? AND banner_image IS NOT NULL').all(trip.id);
          const activityBanners = db.prepare('SELECT banner_image FROM activities WHERE trip_id = ? AND banner_image IS NOT NULL').all(trip.id);

          [...transportBanners, ...lodgingBanners, ...activityBanners].forEach(item => {
              if (item.banner_image) { // Check if banner_image is not null
                  try {
                    const bannerPath = path.join(__dirname, '..', item.banner_image);
                    if (fs.existsSync(bannerPath)) fs.unlinkSync(bannerPath);
                  } catch(err){ console.error(`Error deleting banner: ${item.banner_image}`, err); }
              }
          });

          // Trip cover image
          const currentTrip = db.prepare('SELECT cover_image FROM trips WHERE id = ?').get(trip.id);
           if (currentTrip && currentTrip.cover_image && !currentTrip.cover_image.includes('default')) {
              try {
                const coverPath = path.join(__dirname, '..', currentTrip.cover_image);
                if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
              } catch(err){ console.error(`Error deleting cover image: ${currentTrip.cover_image}`, err); }
          }
        }

        // Delete all trip_members entries for this user (both owned and shared)
        db.prepare('DELETE FROM trip_members WHERE user_id = ?').run(userId);

        // Delete owned trips (will cascade delete related entities like transport, lodging, activities, checklist items, budget expenses)
        db.prepare('DELETE FROM trips WHERE owner_id = ?').run(userId);

        // Delete all documents uploaded BY this user that might still exist (e.g., on trips they didn't own but uploaded docs for)
        const remainingDocs = db.prepare('SELECT id, file_path FROM documents WHERE uploaded_by = ?').all(userId);
        remainingDocs.forEach(doc => {
           try {
                const filePath = path.join(__dirname, '..', doc.file_path);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              } catch(err){ console.error(`Error deleting remaining file: ${doc.file_path}`, err); }
        });
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