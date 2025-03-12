// server/controllers/documentController.js
const { db } = require('../db/database');
const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');

/**
 * Upload a document
 */
const uploadDocument = (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reference_type, reference_id } = req.body;
    const userId = req.user.id;
    
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Validate reference type
    const validReferenceTypes = ['trip', 'transportation', 'lodging', 'activity'];
    if (!validReferenceTypes.includes(reference_type)) {
      return res.status(400).json({ message: 'Invalid reference type' });
    }
    
    // Check if reference exists and get the associated tripId
    let exists = false;
    let tripId = null;
    
    if (reference_type === 'trip') {
      const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(reference_id);
      exists = !!trip;
      tripId = exists ? reference_id : null;
    } else if (reference_type === 'transportation') {
      const transport = db.prepare('SELECT * FROM transportation WHERE id = ?').get(reference_id);
      exists = !!transport;
      tripId = exists ? transport.trip_id : null;
    } else if (reference_type === 'lodging') {
      const lodging = db.prepare('SELECT * FROM lodging WHERE id = ?').get(reference_id);
      exists = !!lodging;
      tripId = exists ? lodging.trip_id : null;
    } else if (reference_type === 'activity') {
      const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(reference_id);
      exists = !!activity;
      tripId = exists ? activity.trip_id : null;
    }
    
    if (!exists) {
      return res.status(404).json({ message: `${reference_type} not found` });
    }
    
    // Check user's permission for the trip
    if (tripId) {
      const tripMember = db.prepare(`
        SELECT role FROM trip_members 
        WHERE trip_id = ? AND user_id = ?
      `).get(tripId, userId);
      
      if (!tripMember || !['owner', 'editor'].includes(tripMember.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    // Insert document
    const file_path = `/uploads/documents/${req.file.filename}`;
    const file_name = req.file.originalname;
    const file_type = req.file.mimetype;
    
    const insert = db.prepare(`
      INSERT INTO documents (
        reference_type, reference_id, file_path, file_name, file_type, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = insert.run(
      reference_type, reference_id, file_path, file_name, file_type, userId
    );
    
    // Get the created document
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
    
    return res.status(201).json({
      message: 'Document uploaded successfully',
      document
    });
  } catch (error) {
    console.error('Upload document error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get a document
 */
const getDocument = (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Get document
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    return res.status(200).json({ document });
  } catch (error) {
    console.error('Get document error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a document
 */
const deleteDocument = (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Get document
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Delete file from filesystem
    const filePath = path.join(__dirname, '..', document.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete from database
    db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
    
    return res.status(200).json({
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Download a document
 */
const downloadDocument = (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Get document
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Get file path
    const filePath = path.join(__dirname, '..', document.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Send file for download (with content-disposition: attachment)
    return res.download(filePath, document.file_name);
  } catch (error) {
    console.error('Download document error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * View a document (for inline browser viewing)
 */
const viewDocument = (req, res) => {
  try {
    console.log('OK');
    const { documentId } = req.params;
    
    // Get document
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Get file path
    const filePath = path.join(__dirname, '..', document.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Send file for inline viewing (without content-disposition: attachment)
    res.setHeader('Content-Type', document.file_type);
    return res.sendFile(filePath);
  } catch (error) {
    console.error('View document error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get documents by reference
 */
const getDocumentsByReference = (req, res) => {
  try {
    const { reference_type, reference_id } = req.params;
    
    // Validate reference type
    const validReferenceTypes = ['trip', 'transportation', 'lodging', 'activity'];
    if (!validReferenceTypes.includes(reference_type)) {
      return res.status(400).json({ message: 'Invalid reference type' });
    }
    
    // Get documents
    const documents = db.prepare(`
      SELECT * FROM documents 
      WHERE reference_type = ? AND reference_id = ?
      ORDER BY created_at DESC
    `).all(reference_type, reference_id);
    
    return res.status(200).json({ documents });
  } catch (error) {
    console.error('Get documents by reference error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  uploadDocument,
  getDocument,
  deleteDocument,
  downloadDocument,
  viewDocument,
  getDocumentsByReference
};