// server/controllers/activityController.js
const { db } = require('../db/database');
const { validationResult } = require('express-validator');
const { queueNotificationsForTripMembers } = require('../utils/emailQueueService');
const path = require('path'); // Import path
const fs = require('fs'); // Import fs

/**
 * Get all activities for a trip
 */
const getTripActivities = (req, res) => {
  try {
    const { tripId } = req.params;

    // Get activities
    const activities = db.prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM documents WHERE reference_type = 'activity' AND reference_id = a.id) as has_documents
      FROM activities a
      WHERE a.trip_id = ?
      ORDER BY a.date, a.time
    `).all(tripId);

    return res.status(200).json({ activities });
  } catch (error) {
    console.error('Get activities error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get a single activity
 */
const getActivity = (req, res) => {
  try {
    const { activityId } = req.params;

    // Get activity
    const activity = db.prepare(`
      SELECT a.*
      FROM activities a
      WHERE a.id = ?
    `).get(activityId);

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    // Get documents
    const documents = db.prepare(`
      SELECT d.id, d.file_name, d.file_type, d.file_path, d.created_at
      FROM documents d
      WHERE d.reference_type = 'activity' AND d.reference_id = ?
    `).all(activityId);

    return res.status(200).json({
      activity,
      documents
    });
  } catch (error) {
    console.error('Get activity error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create a new activity
 */
const createActivity = (req, res) => {
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
      date,
      time,
      location,
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
      bannerImage = `/uploads/activities/${req.file.filename}`;
    }

    // Insert activity
    const insert = db.prepare(`
      INSERT INTO activities (
        trip_id, name, date, time, location,
        confirmation_code, notes, banner_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      tripId, name, date, time, location, confirmation_code, notes, bannerImage
    );

    // Get the created activity
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(result.lastInsertRowid);

    // Queue notification emails for other trip members (batched)
    const updateData = {
      activityName: name,
      activityDate: new Date(date).toLocaleDateString(),
      activityTime: time || '',
      activityLocation: location || 'N/A',
      activityCode: confirmation_code || '',
      activityImage: bannerImage ? `${process.env.FRONTEND_URL}${bannerImage}` : null
    };

    queueNotificationsForTripMembers(tripId, updaterUserId, 'activity', updateData, {
      name: trip.name,
      location: trip.location
    });

    return res.status(201).json({
      message: 'Activity added successfully',
      activity
    });
  } catch (error) {
    console.error('Create activity error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update an activity
 */
const updateActivity = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { activityId } = req.params;
    const {
      name,
      date,
      time,
      location,
      confirmation_code,
      notes
    } = req.body;

    // Check if activity exists
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    // Handle banner image if uploaded
    let bannerImage = activity.banner_image;

    if (req.file) {
      // Set the new banner image path
      bannerImage = `/uploads/activities/${req.file.filename}`;

      // Try to delete the old image file if it exists
      if (activity.banner_image) {
        try {
          const oldImagePath = path.join(__dirname, '..', activity.banner_image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (fileError) {
          console.error('Error deleting old banner image:', fileError);
        }
      }
    } else if (req.body.remove_banner === 'true') {
      // Handle explicit request to remove the banner
      if (activity.banner_image) {
        try {
          const oldImagePath = path.join(__dirname, '..', activity.banner_image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (fileError) {
          console.error('Error deleting banner image:', fileError);
        }
      }
      bannerImage = null;
    }

    // Update activity
    const update = db.prepare(`
      UPDATE activities
      SET name = ?, date = ?, time = ?, location = ?,
          confirmation_code = ?, notes = ?, banner_image = ?
      WHERE id = ?
    `);

    update.run(
      name, date, time, location, confirmation_code, notes, bannerImage, activityId
    );

    // Get updated activity
    const updatedActivity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);

    return res.status(200).json({
      message: 'Activity updated successfully',
      activity: updatedActivity
    });
  } catch (error) {
    console.error('Update activity error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete an activity
 */
const deleteActivity = (req, res) => {
  try {
    const { activityId } = req.params;

    // Check if activity exists
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    // Get associated documents
    const documents = db.prepare(`
      SELECT * FROM documents
      WHERE reference_type = 'activity' AND reference_id = ?
    `).all(activityId);

    // Start transaction
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Delete banner image if exists
      if (activity.banner_image) {
        try { // Add try-catch for file deletion
          const imagePath = path.join(__dirname, '..', activity.banner_image);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (err) {
          console.error("Error deleting activity banner:", err);
        }
      }

      // Delete documents first
      if (documents.length > 0) {
        // Also delete document files
        documents.forEach(doc => {
          try {
            const filePath = path.join(__dirname, '..', doc.file_path);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            console.error("Error deleting document file:", err);
          }
        });
        db.prepare(`
          DELETE FROM documents
          WHERE reference_type = 'activity' AND reference_id = ?
        `).run(activityId);
      }

      // Delete activity
      db.prepare('DELETE FROM activities WHERE id = ?').run(activityId);

      // Commit transaction
      db.prepare('COMMIT').run();

      return res.status(200).json({
        message: 'Activity deleted successfully'
      });
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Delete activity error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTripActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity
};