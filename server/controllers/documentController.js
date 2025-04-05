// server/controllers/documentController.js
const { db } = require('../db/database');
const fs = require('fs');
const path = require('path');
// validationResult is no longer needed here for the main body validation
const { getUserById } = require('./tripController'); // Import helper if needed for permissions

// Helper function to check trip access based on reference
const checkDocumentPermission = (userId, reference_type, reference_id, requiredRoles = ['owner', 'editor']) => {
    let tripId = null;
    let referenceTable = '';
    let referenceColumn = 'id';

    switch (reference_type) {
        case 'trip':
            tripId = reference_id; // Reference ID is the Trip ID
            break;
        case 'transportation':
            referenceTable = 'transportation';
            break;
        case 'lodging':
            referenceTable = 'lodging';
            break;
        case 'activity':
            referenceTable = 'activities';
            break;
        default:
            return false; // Invalid reference type
    }

    // If not a direct trip reference, fetch the trip_id from the related item
    if (!tripId && referenceTable) {
        try {
            // Ensure reference_id is treated as a number for these tables if needed
            const refIdNum = parseInt(reference_id, 10);
             if (isNaN(refIdNum)) return false; // Invalid ID format for non-trip refs

            const item = db.prepare(`SELECT trip_id FROM ${referenceTable} WHERE ${referenceColumn} = ?`).get(refIdNum);
            if (!item) return false; // Reference item not found
            tripId = item.trip_id;
        } catch (dbError) {
            console.error(`Error fetching trip_id for ${reference_type} ${reference_id}:`, dbError);
            return false;
        }
    }

    if (!tripId) return false; // Could not determine tripId

    // Check membership and role
    try {
        const member = db.prepare('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?').get(tripId, userId);
        return member && requiredRoles.includes(member.role);
    } catch (dbError) {
        console.error(`Error checking trip membership for trip ${tripId}, user ${userId}:`, dbError);
        return false;
    }
};


/**
 * Upload a document
 */
const uploadDocument = async (req, res) => { // Make async if needed later
  try {
    // ValidationResult check is now done in the route definition

    const { reference_type, reference_id } = req.body;
    const userId = req.user.id;

    // Check if file exists (Multer error handler already ran, but double-check)
    if (!req.file) {
      // This case should ideally be caught by handleUpload if no file was sent.
      // If reached here, it might mean file was sent but Multer didn't process it.
      return res.status(400).json({ message: 'No file uploaded or file rejected.' });
    }

     // *** Permission Check ***
    if (!checkDocumentPermission(userId, reference_type, reference_id, ['owner', 'editor'])) {
        // If permission denied, delete the uploaded file
        if (req.file && req.file.path) {
             fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting uploaded file after permission failure:", unlinkErr);
             });
        }
        return res.status(403).json({ message: 'Access Denied: You do not have permission to upload documents for this item.' });
    }

    // Reference validation (basic check, specific existence check integrated into permission check)
    const validReferenceTypes = ['trip', 'transportation', 'lodging', 'activity'];
    if (!validReferenceTypes.includes(reference_type)) {
       // If invalid reference type, delete the uploaded file
        if (req.file && req.file.path) {
             fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting uploaded file due to invalid reference type:", unlinkErr);
             });
        }
      return res.status(400).json({ message: 'Invalid reference type' });
    }

    // Construct file path relative to server root for DB
    // Assumes 'uploads' is served at root, and files are in uploads/documents
    const relativeFilePath = `/uploads/documents/${req.file.filename}`;
    const file_name = req.file.originalname;
    const file_type = req.file.mimetype;

    // Insert document metadata into the database
    const insert = db.prepare(`
      INSERT INTO documents (
        reference_type, reference_id, file_path, file_name, file_type, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      reference_type, reference_id, relativeFilePath, file_name, file_type, userId
    );

    // Get the created document record
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      message: 'Document uploaded successfully',
      document
    });
  } catch (error) {
     // General error handling (e.g., database errors)
    console.error('Upload document controller error:', error);
     // Attempt to delete uploaded file if an error occurs after upload but before DB insert completion
     if (req.file && req.file.path) {
        fs.unlink(req.file.path, (unlinkErr) => {
           if (unlinkErr) console.error("Error deleting uploaded file after controller error:", unlinkErr);
        });
     }
    return res.status(500).json({ message: 'Server error during document processing.' });
  }
};

/**
 * Get a document's metadata
 */
const getDocument = (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // *** Permission Check ***
    if (!checkDocumentPermission(userId, document.reference_type, document.reference_id, ['owner', 'editor', 'viewer'])) {
         return res.status(403).json({ message: 'Access Denied: You do not have permission to view this document.' });
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
     // Permission is already checked by requireEditAccess middleware in the route

    // Get document to find file path
    const document = db.prepare('SELECT file_path FROM documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, '..', document.file_path);
     try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        } else {
             console.warn(`Document file not found for deletion: ${filePath}`);
        }
     } catch(err) {
         console.error(`Error deleting document file ${filePath}:`, err);
         // Decide if you want to proceed with DB deletion even if file deletion fails
         // return res.status(500).json({ message: 'Error deleting document file.' });
     }


    // Delete from database
    const result = db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);

    if (result.changes === 0) {
         // This might happen if the document was deleted between the check and the delete operation
         return res.status(404).json({ message: 'Document not found or already deleted.' });
    }

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
    const userId = req.user.id;

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // *** Permission Check ***
    if (!checkDocumentPermission(userId, document.reference_type, document.reference_id, ['owner', 'editor', 'viewer'])) {
         return res.status(403).json({ message: 'Access Denied: You do not have permission to download this document.' });
    }

    const filePath = path.join(__dirname, '..', document.file_path);
    if (!fs.existsSync(filePath)) {
      console.error(`Document file not found for download: ${filePath}`);
      return res.status(404).json({ message: 'File not found on server.' });
    }

    // Send file for download
    return res.download(filePath, document.file_name); // Set filename for download prompt
  } catch (error) {
    console.error('Download document error:', error);
    // Avoid sending JSON response if headers might have already been sent by res.download on error
    if (!res.headersSent) {
         res.status(500).json({ message: 'Server error during download.' });
    }
  }
};

/**
 * View a document (for inline browser viewing)
 */
const viewDocument = (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // *** Permission Check ***
    if (!checkDocumentPermission(userId, document.reference_type, document.reference_id, ['owner', 'editor', 'viewer'])) {
         return res.status(403).json({ message: 'Access Denied: You do not have permission to view this document.' });
    }

    const filePath = path.join(__dirname, '..', document.file_path);
    if (!fs.existsSync(filePath)) {
       console.error(`Document file not found for viewing: ${filePath}`);
      return res.status(404).json({ message: 'File not found on server.' });
    }

    // Set Content-Type header based on the stored file type
    res.setHeader('Content-Type', document.file_type);
    // Use sendFile for potentially better handling than piping
    return res.sendFile(filePath);
  } catch (error) {
    console.error('View document error:', error);
     if (!res.headersSent) {
        res.status(500).json({ message: 'Server error during file viewing.' });
     }
  }
};

/**
 * Get documents by reference
 */
const getDocumentsByReference = (req, res) => {
  try {
    const { reference_type, reference_id } = req.params;
    const userId = req.user.id;

    // *** Permission Check ***
     if (!checkDocumentPermission(userId, reference_type, reference_id, ['owner', 'editor', 'viewer'])) {
         return res.status(403).json({ message: 'Access Denied: You do not have permission to view documents for this item.' });
     }


    const validReferenceTypes = ['trip', 'transportation', 'lodging', 'activity'];
    if (!validReferenceTypes.includes(reference_type)) {
      return res.status(400).json({ message: 'Invalid reference type' });
    }

    // Get documents
    const documents = db.prepare(`
      SELECT id, file_name, file_type, created_at, uploaded_by
      FROM documents
      WHERE reference_type = ? AND reference_id = ?
      ORDER BY created_at DESC
    `).all(reference_type, reference_id); // Don't send file_path in list view

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
  getDocumentsByReference,
  checkDocumentPermission
};