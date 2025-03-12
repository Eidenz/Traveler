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
    
    // Check if reference exists
    let exists = false;
    if (reference_type === 'trip') {
      exists = db.prepare('SELECT * FROM trips WHERE id = ?').get(reference_id) !== undefined;
    } else if (reference_type === 'transportation') {
      exists = db.prepare('SELECT * FROM transportation WHERE id = ?').get(reference_id) !== undefined;
    } else if (reference_type === 'lodging') {
      exists = db.prepare('SELECT * FROM lodging WHERE id = ?').get(reference_id) !== undefined;
    } else if (reference_type === 'activity') {
      exists = db.prepare('SELECT * FROM activities WHERE id = ?').get(reference_id) !== undefined;
    }
    
    if (!exists) {
      return res.status(404).json({ message: `${reference_type} not found` });
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
    
    // Send file
    return res.download(filePath, document.file_name);
  } catch (error) {
    console.error('Download document error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  uploadDocument,
  getDocument,
  deleteDocument,
  downloadDocument
};