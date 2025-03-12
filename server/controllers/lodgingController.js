// server/controllers/lodgingController.js
const { db } = require('../db/database');
const { validationResult } = require('express-validator');

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
    
    // Insert lodging
    const insert = db.prepare(`
      INSERT INTO lodging (
        trip_id, name, address, check_in, check_out, confirmation_code, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insert.run(
      tripId, name, address, check_in, check_out, confirmation_code, notes
    );
    
    // Get the created lodging
    const lodging = db.prepare('SELECT * FROM lodging WHERE id = ?').get(result.lastInsertRowid);
    
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
    
    // Update lodging
    const update = db.prepare(`
      UPDATE lodging
      SET name = ?, address = ?, check_in = ?, check_out = ?,
          confirmation_code = ?, notes = ?
      WHERE id = ?
    `);
    
    update.run(
      name, address, check_in, check_out, confirmation_code, notes, lodgingId
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
      // Delete documents first (foreign key constraint)
      if (documents.length > 0) {
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