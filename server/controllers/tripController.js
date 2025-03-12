// server/controllers/tripController.js
const { db } = require('../db/database');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

/**
 * Get all trips for the current user
 */
const getUserTrips = (req, res) => {
  try {
    const userId = req.user.id;

    // Get all trips where user is a member
    const trips = db.prepare(`
      SELECT t.*, tm.role 
      FROM trips t
      JOIN trip_members tm ON t.id = tm.trip_id
      WHERE tm.user_id = ?
      ORDER BY t.start_date DESC
    `).all(userId);

    return res.status(200).json({ trips });
  } catch (error) {
    console.error('Get user trips error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get a single trip by ID
 */
const getTripById = (req, res) => {
  try {
    const { tripId } = req.params;

    // Get basic trip info
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Get trip members
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.profile_image, tm.role
      FROM trip_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.trip_id = ?
    `).all(tripId);

    // Get transportation
    const transportation = db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM documents WHERE reference_type = 'transportation' AND reference_id = t.id) as has_documents
      FROM transportation t
      WHERE t.trip_id = ?
      ORDER BY t.departure_date, t.departure_time
    `).all(tripId);

    // Get lodging
    const lodging = db.prepare(`
      SELECT l.*, 
        (SELECT COUNT(*) FROM documents WHERE reference_type = 'lodging' AND reference_id = l.id) as has_documents
      FROM lodging l
      WHERE l.trip_id = ?
      ORDER BY l.check_in
    `).all(tripId);

    // Get activities
    const activities = db.prepare(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM documents WHERE reference_type = 'activity' AND reference_id = a.id) as has_documents
      FROM activities a
      WHERE a.trip_id = ?
      ORDER BY a.date, a.time
    `).all(tripId);

    return res.status(200).json({
      trip,
      members,
      transportation,
      lodging,
      activities
    });
  } catch (error) {
    console.error('Get trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Create a new trip
 */
const createTrip = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, location, start_date, end_date } = req.body;
    const userId = req.user.id;
    
    let coverImage = null;
    if (req.file) {
      coverImage = `/uploads/${req.file.filename}`;
    }

    // Start a transaction
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Insert trip
      const insertTrip = db.prepare(`
        INSERT INTO trips (name, description, location, start_date, end_date, cover_image, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = insertTrip.run(name, description, location, start_date, end_date, coverImage, userId);
      
      const tripId = result.lastInsertRowid;
      
      // Add user as owner in trip_members
      const insertMember = db.prepare(`
        INSERT INTO trip_members (trip_id, user_id, role)
        VALUES (?, ?, ?)
      `);
      insertMember.run(tripId, userId, 'owner');
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
      // Get the created trip
      const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
      
      return res.status(201).json({
        message: 'Trip created successfully',
        trip
      });
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Create trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a trip
 */
const updateTrip = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tripId } = req.params;
    const { name, description, location, start_date, end_date } = req.body;
    
    // Get current trip
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    // Handle cover image
    let coverImage = trip.cover_image;
    if (req.file) {
      // Delete old image if exists and not the default
      if (trip.cover_image && !trip.cover_image.includes('default')) {
        const oldImagePath = path.join(__dirname, '..', trip.cover_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      coverImage = `/uploads/${req.file.filename}`;
    }
    
    // Update trip
    const updateTrip = db.prepare(`
      UPDATE trips
      SET name = ?, description = ?, location = ?, start_date = ?, end_date = ?, cover_image = ?
      WHERE id = ?
    `);
    
    updateTrip.run(name, description, location, start_date, end_date, coverImage, tripId);
    
    // Get updated trip
    const updatedTrip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    
    return res.status(200).json({
      message: 'Trip updated successfully',
      trip: updatedTrip
    });
  } catch (error) {
    console.error('Update trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a trip
 */
const deleteTrip = (req, res) => {
  try {
    const { tripId } = req.params;
    
    // Get current trip
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    // Start transaction
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      // Delete trip documents
      const tripDocs = db.prepare('SELECT * FROM documents WHERE reference_type = ? AND reference_id = ?').all('trip', tripId);
      const transportDocs = db.prepare(`
        SELECT d.* FROM documents d
        JOIN transportation t ON d.reference_id = t.id
        WHERE d.reference_type = 'transportation' AND t.trip_id = ?
      `).all(tripId);
      const lodgingDocs = db.prepare(`
        SELECT d.* FROM documents d
        JOIN lodging l ON d.reference_id = l.id
        WHERE d.reference_type = 'lodging' AND l.trip_id = ?
      `).all(tripId);
      const activityDocs = db.prepare(`
        SELECT d.* FROM documents d
        JOIN activities a ON d.reference_id = a.id
        WHERE d.reference_type = 'activity' AND a.trip_id = ?
      `).all(tripId);
      
      const allDocs = [...tripDocs, ...transportDocs, ...lodgingDocs, ...activityDocs];
      
      // Delete document files
      allDocs.forEach(doc => {
        try {
          const filePath = path.join(__dirname, '..', doc.file_path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error(`Error deleting file: ${doc.file_path}`, err);
        }
      });
      
      // Delete cover image
      if (trip.cover_image && !trip.cover_image.includes('default')) {
        try {
          const coverPath = path.join(__dirname, '..', trip.cover_image);
          if (fs.existsSync(coverPath)) {
            fs.unlinkSync(coverPath);
          }
        } catch (err) {
          console.error(`Error deleting cover image: ${trip.cover_image}`, err);
        }
      }
      
      // Delete trip (cascades to transportation, lodging, activities, trip_members)
      db.prepare('DELETE FROM trips WHERE id = ?').run(tripId);
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
      return res.status(200).json({
        message: 'Trip deleted successfully'
      });
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Delete trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Share a trip with another user
 */
const shareTrip = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tripId } = req.params;
    const { email, role } = req.body;
    
    // Validate role
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be editor or viewer.' });
    }
    
    // Find user by email
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    // Check if user is already a member of this trip
    const existingMember = db.prepare('SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?')
      .get(tripId, user.id);
      
    if (existingMember) {
      // Update role if user is already a member
      db.prepare('UPDATE trip_members SET role = ? WHERE trip_id = ? AND user_id = ?')
        .run(role, tripId, user.id);
        
      return res.status(200).json({
        message: `User's role updated to ${role}`
      });
    }
    
    // Add user as a member
    db.prepare('INSERT INTO trip_members (trip_id, user_id, role) VALUES (?, ?, ?)')
      .run(tripId, user.id, role);
      
    return res.status(200).json({
      message: `Trip shared with ${user.name}`
    });
  } catch (error) {
    console.error('Share trip error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Remove a user from a trip
 */
const removeTripMember = (req, res) => {
  try {
    const { tripId, userId } = req.params;
    
    // Check if trip exists
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    // Cannot remove the owner
    const member = db.prepare('SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?')
      .get(tripId, userId);
      
    if (!member) {
      return res.status(404).json({ message: 'User is not a member of this trip' });
    }
    
    if (member.role === 'owner') {
      return res.status(403).json({ message: 'Cannot remove the owner of the trip' });
    }
    
    // Remove member
    db.prepare('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?')
      .run(tripId, userId);
      
    return res.status(200).json({
      message: 'User removed from trip'
    });
  } catch (error) {
    console.error('Remove trip member error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUserTrips,
  getTripById,
  createTrip,
  updateTrip,
  deleteTrip,
  shareTrip,
  removeTripMember
};