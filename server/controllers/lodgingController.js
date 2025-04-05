// server/controllers/lodgingController.js
const { db } = require('../db/database');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../utils/emailService');
const { getUserById } = require('./tripController'); // Import helper
const { getTripMembersForNotification } = require('./transportationController'); // Import helper
const path = require('path'); // Import path
const fs = require('fs'); // Import fs

/**
 * Get all lodging for a trip
 */
const getTripLodging = (req, res) => {
  try {
    const { tripId } = req.params;

    // Get lodging
    const lodging = db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM documents WHERE reference_type = 'lodging' AND reference_id = l.id) as has_documents
      FROM lodging l
      WHERE l.trip_id = ?
      ORDER BY l.check_in
    `).all(tripId);

    return res.status(200).json({ lodging });
  } catch (error) {
    console.error('Get lodging error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get a single lodging item
 */
const getLodging = (req, res) => {
  try {
    const { lodgingId } = req.params;

    // Get lodging
    const lodging = db.prepare(`
      SELECT l.*
      FROM lodging l
      WHERE l.id = ?
    `).get(lodgingId);

    if (!lodging) {
      return res.status(404).json({ message: 'Lodging not found' });
    }

    // Get documents
    const documents = db.prepare(`
      SELECT d.id, d.file_name, d.file_type, d.file_path, d.created_at
      FROM documents d
      WHERE d.reference_type = 'lodging' AND d.reference_id = ?
    `).all(lodgingId);

    return res.status(200).json({
      lodging,
      documents
    });
  } catch (error) {
    console.error('Get lodging error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create a new lodging item
 */
const createLodging = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tripId } = req.params;
    const updaterUserId = req.user.id;
    const {
      name,
      address,
      check_in,
      check_out,
      confirmation_code,
      notes
    } = req.body;

    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Handle banner image if uploaded
    let bannerImage = null;
    if (req.file) {
      bannerImage = `/uploads/lodging/${req.file.filename}`;
    }

    // Insert lodging
    const insert = db.prepare(`
      INSERT INTO lodging (
        trip_id, name, address, check_in, check_out,
        confirmation_code, notes, banner_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      tripId, name, address, check_in, check_out, confirmation_code, notes, bannerImage
    );

    // Get the created lodging
    const lodging = db.prepare('SELECT * FROM lodging WHERE id = ?').get(result.lastInsertRowid);

    // Send notification emails to other trip members
    const membersToNotify = getTripMembersForNotification(tripId, updaterUserId);
    const updater = getUserById(updaterUserId);

    membersToNotify.forEach(member => {
        const emailData = {
            isLodging: true, // Flag for template
            userName: member.name,
            userEmail: member.email,
            updaterName: updater.name,
            updaterAvatar: updater.profile_image ? `${process.env.FRONTEND_URL}${updater.profile_image}` : 'https://example.com/default-avatar.png',
            tripName: trip.name,
            tripDestination: trip.location || 'Unknown Destination',
            updateType: 'Accommodation',
            lodgingName: name,
            lodgingAddress: address || 'N/A',
            lodgingCheckIn: new Date(check_in).toLocaleDateString(),
            lodgingCheckOut: new Date(check_out).toLocaleDateString(),
            lodgingCode: confirmation_code || '',
            lodgingImage: bannerImage ? `${process.env.FRONTEND_URL}${bannerImage}` : null,
            tripLink: `${process.env.FRONTEND_URL}/trips/${tripId}`,
            appLink: `${process.env.FRONTEND_URL}/dashboard`,
            // Add common links
            privacyLink: `${process.env.FRONTEND_URL}/privacy`,
            termsLink: `${process.env.FRONTEND_URL}/terms`,
            unsubscribeLink: `${process.env.FRONTEND_URL}/unsubscribe`,
            facebookLink: 'https://facebook.com',
            twitterLink: 'https://twitter.com',
            instagramLink: 'https://instagram.com'
        };
        sendEmail(
            member.email,
            `Update on trip "${trip.name}": New Accommodation Added`,
            'trip-update-template',
            emailData
        );
    });

    return res.status(201).json({
      message: 'Lodging added successfully',
      lodging
    });
  } catch (error) {
    console.error('Create lodging error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a lodging item
 */
const updateLodging = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { lodgingId } = req.params;
    const {
      name,
      address,
      check_in,
      check_out,
      confirmation_code,
      notes
    } = req.body;

    // Check if lodging exists
    const lodging = db.prepare('SELECT * FROM lodging WHERE id = ?').get(lodgingId);
    if (!lodging) {
      return res.status(404).json({ message: 'Lodging not found' });
    }

    // Handle banner image if uploaded
    let bannerImage = lodging.banner_image;

    if (req.file) {
      // Set the new banner image path
      bannerImage = `/uploads/lodging/${req.file.filename}`;

      // Try to delete the old image file if it exists
      if (lodging.banner_image) {
        try {
          const oldImagePath = path.join(__dirname, '..', lodging.banner_image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (fileError) {
           console.error('Error deleting old banner image:', fileError);
        }
      }
    } else if (req.body.remove_banner === 'true') {
      // Handle explicit request to remove the banner
      if (lodging.banner_image) {
        try {
          const oldImagePath = path.join(__dirname, '..', lodging.banner_image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (fileError) {
          console.error('Error deleting banner image:', fileError);
        }
      }
      bannerImage = null;
    }

    // Update lodging
    const update = db.prepare(`
      UPDATE lodging
      SET name = ?, address = ?, check_in = ?, check_out = ?,
          confirmation_code = ?, notes = ?, banner_image = ?
      WHERE id = ?
    `);

    update.run(
      name, address, check_in, check_out, confirmation_code, notes, bannerImage, lodgingId
    );

    // Get updated lodging
    const updatedLodging = db.prepare('SELECT * FROM lodging WHERE id = ?').get(lodgingId);

    return res.status(200).json({
      message: 'Lodging updated successfully',
      lodging: updatedLodging
    });
  } catch (error) {
    console.error('Update lodging error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a lodging item
 */
const deleteLodging = (req, res) => {
  try {
    const { lodgingId } = req.params;

    // Check if lodging exists
    const lodging = db.prepare('SELECT * FROM lodging WHERE id = ?').get(lodgingId);
    if (!lodging) {
      return res.status(404).json({ message: 'Lodging not found' });
    }

    // Get associated documents
    const documents = db.prepare(`
      SELECT * FROM documents
      WHERE reference_type = 'lodging' AND reference_id = ?
    `).all(lodgingId);

    // Start transaction
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Delete banner image if exists
      if (lodging.banner_image) {
         try { // Add try-catch for file deletion
            const imagePath = path.join(__dirname, '..', lodging.banner_image);
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath);
            }
         } catch(err) {
            console.error("Error deleting lodging banner:", err);
         }
      }

      // Delete documents first (foreign key constraint)
      if (documents.length > 0) {
         // Also delete document files
        documents.forEach(doc => {
            try {
                const filePath = path.join(__dirname, '..', doc.file_path);
                if(fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch(err) {
                 console.error("Error deleting document file:", err);
            }
        });
        db.prepare(`
          DELETE FROM documents
          WHERE reference_type = 'lodging' AND reference_id = ?
        `).run(lodgingId);
      }

      // Delete lodging
      db.prepare('DELETE FROM lodging WHERE id = ?').run(lodgingId);

      // Commit transaction
      db.prepare('COMMIT').run();

      return res.status(200).json({
        message: 'Lodging deleted successfully'
      });
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Delete lodging error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTripLodging,
  getLodging,
  createLodging,
  updateLodging,
  deleteLodging
};