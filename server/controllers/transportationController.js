// server/controllers/transportationController.js
const { db } = require('../db/database');
const { validationResult } = require('express-validator');
const { queueNotificationsForTripMembers } = require('../utils/emailQueueService');
const { emitToTrip } = require('../utils/socketService');
const path = require('path');
const fs = require('fs');

// Helper to get trip members who should receive notifications
const getTripMembersForNotification = (tripId, excludeUserId) => {
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.profile_image, u.receiveEmails
    FROM users u
    JOIN trip_members tm ON u.id = tm.user_id
    WHERE tm.trip_id = ? AND u.id != ? AND u.receiveEmails = 1
  `).all(tripId, excludeUserId);
};


/**
 * Get all transportation for a trip
 */
const getTripTransportation = (req, res) => {
  try {
    const { tripId } = req.params;

    // Get transportation
    const transportation = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM documents WHERE reference_type = 'transportation' AND reference_id = t.id) as has_documents
      FROM transportation t
      WHERE t.trip_id = ?
      ORDER BY t.departure_date, t.departure_time
    `).all(tripId);

    return res.status(200).json({ transportation });
  } catch (error) {
    console.error('Get transportation error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get a single transportation item
 */
const getTransportation = (req, res) => {
  try {
    const { transportId } = req.params;

    // Get transportation
    const transportation = db.prepare(`
      SELECT t.*
      FROM transportation t
      WHERE t.id = ?
    `).get(transportId);

    if (!transportation) {
      return res.status(404).json({ message: 'Transportation not found' });
    }

    // Get documents
    const documents = db.prepare(`
      SELECT d.id, d.file_name, d.file_type, d.file_path, d.created_at, d.is_personal
      FROM documents d
      WHERE d.reference_type = 'transportation' AND d.reference_id = ?
    `).all(transportId);

    return res.status(200).json({
      transportation,
      documents
    });
  } catch (error) {
    console.error('Get transportation error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create a new transportation item
 */
const createTransportation = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tripId } = req.params;
    const updaterUserId = req.user.id;
    const {
      type,
      company,
      from_location,
      to_location,
      departure_date,
      departure_time,
      arrival_date,
      arrival_time,
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
      bannerImage = `/uploads/transportation/${req.file.filename}`;
    }

    // Insert transportation
    const insert = db.prepare(`
      INSERT INTO transportation (
        trip_id, type, company, from_location, to_location,
        departure_date, departure_time, arrival_date, arrival_time,
        confirmation_code, notes, banner_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      tripId,
      type, company, from_location, to_location,
      departure_date, departure_time, arrival_date, arrival_time,
      confirmation_code, notes, bannerImage
    );

    // Get the created transportation
    const transportation = db.prepare('SELECT * FROM transportation WHERE id = ?').get(result.lastInsertRowid);

    // Queue notification emails for other trip members (batched)
    const updateData = {
      transportType: type,
      transportCompany: company || 'N/A',
      transportFrom: from_location,
      transportTo: to_location,
      transportDate: new Date(departure_date).toLocaleDateString(),
      transportTime: departure_time || '',
      transportCode: confirmation_code || '',
      transportImage: bannerImage ? `${process.env.FRONTEND_URL}${bannerImage}` : null
    };

    queueNotificationsForTripMembers(tripId, updaterUserId, 'transportation', updateData, {
      name: trip.name,
      location: trip.location
    });

    // Broadcast to other users viewing this trip
    emitToTrip(tripId, 'transport:created', transportation);

    return res.status(201).json({
      message: 'Transportation added successfully',
      transportation
    });
  } catch (error) {
    console.error('Create transportation error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a transportation item
 */
const updateTransportation = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { transportId } = req.params;
    const {
      type,
      company,
      from_location,
      to_location,
      departure_date,
      departure_time,
      arrival_date,
      arrival_time,
      confirmation_code,
      notes
    } = req.body;

    // Check if transportation exists
    const transportation = db.prepare('SELECT * FROM transportation WHERE id = ?').get(transportId);
    if (!transportation) {
      return res.status(404).json({ message: 'Transportation not found' });
    }

    // Handle banner image if uploaded
    let bannerImage = transportation.banner_image;

    if (req.file) {
      // Set the new banner image path
      bannerImage = `/uploads/transportation/${req.file.filename}`;

      // Try to delete the old image file if it exists
      if (transportation.banner_image) {
        try {
          const oldImagePath = path.join(__dirname, '..', transportation.banner_image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (fileError) {
          console.error('Error deleting old banner image:', fileError);
        }
      }
    } else if (req.body.remove_banner === 'true') {
      // Handle explicit request to remove the banner
      if (transportation.banner_image) {
        try {
          const oldImagePath = path.join(__dirname, '..', transportation.banner_image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (fileError) {
          console.error('Error deleting banner image:', fileError);
        }
      }
      bannerImage = null;
    }

    // Update transportation
    const update = db.prepare(`
      UPDATE transportation
      SET type = ?, company = ?, from_location = ?, to_location = ?,
          departure_date = ?, departure_time = ?, arrival_date = ?, arrival_time = ?,
          confirmation_code = ?, notes = ?, banner_image = ?
      WHERE id = ?
    `);

    update.run(
      type, company, from_location, to_location,
      departure_date, departure_time, arrival_date, arrival_time,
      confirmation_code, notes, bannerImage, transportId
    );

    // Get updated transportation
    const updatedTransportation = db.prepare('SELECT * FROM transportation WHERE id = ?').get(transportId);

    // Broadcast to other users viewing this trip
    emitToTrip(updatedTransportation.trip_id, 'transport:updated', updatedTransportation);

    return res.status(200).json({
      message: 'Transportation updated successfully',
      transportation: updatedTransportation
    });
  } catch (error) {
    console.error('Update transportation error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a transportation item
 */
const deleteTransportation = (req, res) => {
  try {
    const { transportId } = req.params;

    // Check if transportation exists
    const transportation = db.prepare('SELECT * FROM transportation WHERE id = ?').get(transportId);
    if (!transportation) {
      return res.status(404).json({ message: 'Transportation not found' });
    }

    // Get associated documents
    const documents = db.prepare(`
      SELECT * FROM documents
      WHERE reference_type = 'transportation' AND reference_id = ?
    `).all(transportId);

    // Start transaction
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Delete banner image if exists
      if (transportation.banner_image) {
        try { // Add try-catch for file deletion
          const imagePath = path.join(__dirname, '..', transportation.banner_image);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (err) {
          console.error("Error deleting transportation banner:", err);
        }
      }

      // Update documents to be unlinked (associated with trip directly)
      db.prepare(`
        UPDATE documents
        SET reference_type = 'trip', reference_id = ?
        WHERE reference_type = 'transportation' AND reference_id = ?
      `).run(transportation.trip_id, transportId);

      // Delete transportation
      db.prepare('DELETE FROM transportation WHERE id = ?').run(transportId);

      // Commit transaction
      db.prepare('COMMIT').run();

      // Broadcast to other users viewing this trip
      emitToTrip(transportation.trip_id, 'transport:deleted', transportId);

      return res.status(200).json({
        message: 'Transportation deleted successfully'
      });
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Delete transportation error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTripTransportation,
  getTransportation,
  createTransportation,
  updateTransportation,
  deleteTransportation,
  getTripMembersForNotification
};