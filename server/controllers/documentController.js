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
    case 'transport':
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


// Normalize a reference id for storage in the TEXT column.
// JSON bodies deliver numeric ids as JS numbers, which SQLite would
// otherwise stringify as '3.0' and break equality lookups.
const normalizeRefId = (reference_id) => {
  if (typeof reference_id === 'number') return String(Math.trunc(reference_id));
  return reference_id;
};

// Helper to get trip_id from reference
const getTripIdFromReference = (reference_type, reference_id) => {
  if (reference_type === 'trip') return reference_id;

  let referenceTable = '';
  let referenceColumn = 'id';

  switch (reference_type) {
    case 'transport':
    case 'transportation': referenceTable = 'transportation'; break;
    case 'lodging': referenceTable = 'lodging'; break;
    case 'activity': referenceTable = 'activities'; break;
    default: return null;
  }

  try {
    const refIdNum = parseInt(reference_id, 10);
    if (isNaN(refIdNum)) return null;

    const item = db.prepare(`SELECT trip_id FROM ${referenceTable} WHERE ${referenceColumn} = ?`).get(refIdNum);
    return item ? item.trip_id : null;
  } catch (error) {
    console.error(`Error getting trip_id for ${reference_type} ${reference_id}:`, error);
    return null;
  }
};

/**
 * Upload a document
 */
// Storage quota per user per trip: each member gets their own allowance in
// every trip, so no one can fill a shared trip for the others and a heavy
// trip never blocks a new one. Sizes are read from disk so no schema change
// is needed; at this app's scale (a handful of users, dozens of documents)
// the stat sweep per upload is negligible.
const UPLOAD_QUOTA_MB = parseInt(process.env.UPLOAD_QUOTA_MB) || 500;
const UPLOAD_QUOTA_BYTES = UPLOAD_QUOTA_MB * 1024 * 1024;

const getUserTripDocumentBytes = (userId, tripId) => {
  const rows = db.prepare(`
    SELECT file_path FROM documents
    WHERE uploaded_by = ? AND trip_id = ? AND file_type != 'link' AND file_path != ''
  `).all(userId, tripId);
  let total = 0;
  for (const row of rows) {
    try {
      total += fs.statSync(path.join(__dirname, '..', row.file_path)).size;
    } catch {
      // File missing on disk — nothing to count
    }
  }
  return total;
};

/**
 * Quota status for the current user in a trip (trip access checked in the
 * route). The client shows this on the documents view.
 */
const getQuotaStatus = (req, res) => {
  try {
    const tripId = req.query.tripId;
    return res.status(200).json({
      used_bytes: getUserTripDocumentBytes(req.user.id, tripId),
      quota_bytes: UPLOAD_QUOTA_BYTES
    });
  } catch (error) {
    console.error('Get quota status error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const uploadDocument = async (req, res) => { // Make async if needed later
  try {
    // ValidationResult check is now done in the route definition

    const { reference_type, reference_id, is_personal } = req.body;
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
    const validReferenceTypes = ['trip', 'transport', 'transportation', 'lodging', 'activity'];
    if (!validReferenceTypes.includes(reference_type)) {
      // If invalid reference type, delete the uploaded file
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting uploaded file due to invalid reference type:", unlinkErr);
        });
      }
      return res.status(400).json({ message: 'Invalid reference type' });
    }

    // specific check for mixed types
    // Resolve trip_id
    const tripId = getTripIdFromReference(reference_type, reference_id);
    if (!tripId) {
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting uploaded file due to unresolved trip:", unlinkErr);
        });
      }
      return res.status(400).json({ message: 'Could not resolve trip for this document.' });
    }

    // *** Quota check *** (after the permission check so unauthorized callers
    // learn nothing about usage; the new file is unlinked on rejection)
    if (getUserTripDocumentBytes(userId, tripId) + req.file.size > UPLOAD_QUOTA_BYTES) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting uploaded file after quota rejection:", unlinkErr);
      });
      return res.status(413).json({
        message: `Storage quota exceeded: your uploads to this trip are limited to ${UPLOAD_QUOTA_MB} MB. Delete some of your documents and try again.`
      });
    }

    // Construct file path relative to server root for DB
    // Assumes 'uploads' is served at root, and files are in uploads/documents
    const relativeFilePath = `/uploads/documents/${req.file.filename}`;
    const file_name = req.file.originalname;
    const file_type = req.file.mimetype;

    // Parse is_personal flag (default to false/0 if not provided)
    const isPersonal = is_personal === 'true' || is_personal === '1' || is_personal === true ? 1 : 0;

    // Insert document metadata into the database
    const insert = db.prepare(`
      INSERT INTO documents (
        reference_type, reference_id, trip_id, file_path, file_name, file_type, uploaded_by, is_personal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Normalize reference_type for DB (transport -> transportation)
    const dbReferenceType = reference_type === 'transport' ? 'transportation' : reference_type;

    const result = insert.run(
      dbReferenceType, reference_id, tripId, relativeFilePath, file_name, file_type, userId, isPersonal
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
 * Create a link document (a URL saved as a document, e.g. a live QR code page).
 * Stored with file_type 'link' and no file on disk.
 */
const createLinkDocument = (req, res) => {
  try {
    const { reference_type, reference_id, url, title, is_personal } = req.body;
    const userId = req.user.id;

    // Validate URL (http/https only)
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ message: 'Invalid URL' });
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ message: 'Only http(s) links are allowed' });
    }

    const validReferenceTypes = ['trip', 'transport', 'transportation', 'lodging', 'activity'];
    if (!validReferenceTypes.includes(reference_type)) {
      return res.status(400).json({ message: 'Invalid reference type' });
    }

    // *** Permission Check ***
    if (!checkDocumentPermission(userId, reference_type, reference_id, ['owner', 'editor'])) {
      return res.status(403).json({ message: 'Access Denied: You do not have permission to add documents for this item.' });
    }

    // Resolve trip_id
    const tripId = getTripIdFromReference(reference_type, reference_id);
    if (!tripId) {
      return res.status(400).json({ message: 'Could not resolve trip for this document.' });
    }

    const file_name = (title && title.trim()) || parsedUrl.hostname;
    const isPersonal = is_personal === 'true' || is_personal === '1' || is_personal === true ? 1 : 0;
    const dbReferenceType = reference_type === 'transport' ? 'transportation' : reference_type;

    const insert = db.prepare(`
      INSERT INTO documents (
        reference_type, reference_id, trip_id, file_path, file_name, file_type, url, uploaded_by, is_personal
      ) VALUES (?, ?, ?, '', ?, 'link', ?, ?, ?)
    `);

    const result = insert.run(
      dbReferenceType, normalizeRefId(reference_id), tripId, file_name, url, userId, isPersonal
    );

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      message: 'Link document created successfully',
      document
    });
  } catch (error) {
    console.error('Create link document error:', error);
    return res.status(500).json({ message: 'Server error' });
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

    // *** Personal Document Check - only uploader can access personal documents ***
    if (document.is_personal && document.uploaded_by !== userId) {
      return res.status(403).json({ message: 'Access Denied: This is a personal document.' });
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
    const userId = req.user.id;

    // Get document to find file path
    const document = db.prepare(
      'SELECT file_path, file_type, reference_type, reference_id, is_personal, uploaded_by FROM documents WHERE id = ?'
    ).get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // *** Permission Check ***
    // The route middleware resolves the trip from the client-supplied tripId,
    // so authorization must be re-checked against this document's own trip.
    if (!checkDocumentPermission(userId, document.reference_type, document.reference_id, ['owner', 'editor'])) {
      return res.status(403).json({ message: 'Access Denied: You do not have permission to delete this document.' });
    }

    // *** Personal Document Check - only the uploader can delete their own personal document ***
    if (document.is_personal && document.uploaded_by !== userId) {
      return res.status(403).json({ message: 'Access Denied: This is a personal document.' });
    }

    // Delete file from filesystem (link documents have no file on disk)
    if (document.file_type !== 'link' && document.file_path) {
      const filePath = path.join(__dirname, '..', document.file_path);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        } else {
          console.warn(`Document file not found for deletion: ${filePath}`);
        }
      } catch (err) {
        console.error(`Error deleting document file ${filePath}:`, err);
        // Decide if you want to proceed with DB deletion even if file deletion fails
        // return res.status(500).json({ message: 'Error deleting document file.' });
      }
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

    // *** Personal Document Check - only uploader can access personal documents ***
    if (document.is_personal && document.uploaded_by !== userId) {
      return res.status(403).json({ message: 'Access Denied: This is a personal document.' });
    }

    // Link documents have no file to download
    if (document.file_type === 'link') {
      return res.status(400).json({ message: 'This document is a link and has no file.', url: document.url });
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

    // *** Personal Document Check - only uploader can access personal documents ***
    if (document.is_personal && document.uploaded_by !== userId) {
      return res.status(403).json({ message: 'Access Denied: This is a personal document.' });
    }

    // Link documents have no file to view inline
    if (document.file_type === 'link') {
      return res.status(400).json({ message: 'This document is a link and has no file.', url: document.url });
    }

    const filePath = path.join(__dirname, '..', document.file_path);
    if (!fs.existsSync(filePath)) {
      console.error(`Document file not found for viewing: ${filePath}`);
      return res.status(404).json({ message: 'File not found on server.' });
    }

    // Derive the Content-Type from the stored extension rather than the
    // client-supplied mimetype, so a mislabelled upload can't be served back as
    // HTML/script on this origin. Anything not inline-safe is forced to download.
    const INLINE_TYPES = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
    };
    const contentType = INLINE_TYPES[path.extname(filePath).toLowerCase()];

    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!contentType) {
      return res.download(filePath, document.file_name);
    }

    res.setHeader('Content-Type', contentType);
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


    const validReferenceTypes = ['trip', 'transport', 'transportation', 'lodging', 'activity'];
    if (!validReferenceTypes.includes(reference_type)) {
      return res.status(400).json({ message: 'Invalid reference type' });
    }

    // Get documents - filter personal documents to only show to uploader
    // Show shared documents (is_personal = 0 or null) to everyone
    // Show personal documents (is_personal = 1) only to the uploader
    // Normalize reference type for DB query
    const dbReferenceType = reference_type === 'transport' ? 'transportation' : reference_type;

    const documents = db.prepare(`
      SELECT id, file_name, file_type, url, created_at, uploaded_by, is_personal
      FROM documents
      WHERE reference_type = ? AND reference_id = ?
        AND (is_personal = 0 OR is_personal IS NULL OR uploaded_by = ?)
      ORDER BY is_personal ASC, created_at DESC
    `).all(dbReferenceType, reference_id, userId);

    return res.status(200).json({ documents });
  } catch (error) {
    console.error('Get documents by reference error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update a document (e.g. link to a different item)
 */
const updateDocument = (req, res) => {
  try {
    const { documentId } = req.params;
    const { reference_type, reference_id, is_personal } = req.body;
    const userId = req.user.id;

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check permission on current document
    if (!checkDocumentPermission(userId, document.reference_type, document.reference_id, ['owner', 'editor'])) {
      return res.status(403).json({ message: 'Access Denied: You do not have permission to edit this document.' });
    }

    // If changing reference, validate new reference and check permission
    if (reference_type && reference_id) {
      // Validate Reference Type
      const validReferenceTypes = ['trip', 'transport', 'transportation', 'lodging', 'activity'];
      if (!validReferenceTypes.includes(reference_type)) {
        return res.status(400).json({ message: 'Invalid reference type' });
      }

      // Check validity and resolving tripId for the new reference
      const newTripId = getTripIdFromReference(reference_type, reference_id);
      if (!newTripId) {
        return res.status(400).json({ message: 'Invalid reference ID or could not resolve trip.' });
      }

      // Ensure we are not moving documents between trips (optional constraint, but good for consistency)
      if (newTripId !== document.trip_id) {
        return res.status(400).json({ message: 'Cannot move documents between different trips.' });
      }

      // Check permission on the NEW reference (must have edit access to the destination trip/item)
      // Since we verified trip_id matches and we checked access to the doc, and role is trip-based, 
      // this is implicitly covered if roles are consistent. 
      // But explicit check doesn't hurt.
      if (!checkDocumentPermission(userId, reference_type, reference_id, ['owner', 'editor'])) {
        return res.status(403).json({ message: 'Access Denied: You do not have permission to link to this item.' });
      }
    }

    // Build update query
    let updateFields = [];
    let params = [];

    if (reference_type) {
      updateFields.push('reference_type = ?');
      params.push(reference_type === 'transport' ? 'transportation' : reference_type);
    }
    if (reference_id) {
      updateFields.push('reference_id = ?');
      params.push(normalizeRefId(reference_id));
    }
    if (is_personal !== undefined) {
      updateFields.push('is_personal = ?');
      params.push(is_personal === true || is_personal === 'true' || is_personal === 1 ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(documentId);

    const runInfo = db.prepare(`UPDATE documents SET ${updateFields.join(', ')} WHERE id = ?`).run(...params);

    const updatedDoc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);

    return res.status(200).json({
      message: 'Document updated successfully',
      document: updatedDoc
    });

  } catch (error) {
    console.error('Update document error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get all documents for a trip
 */
const getAllTripDocuments = (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    // Check trip access (any member can view shared docs)
    // We can reuse checkDocumentPermission with trip reference
    if (!checkDocumentPermission(userId, 'trip', tripId, ['owner', 'editor', 'viewer'])) {
      return res.status(403).json({ message: 'Access Denied: You do not have permission to view documents for this trip.' });
    }

    // Get documents - filter personal documents
    // This query assumes trip_id has been populated (which the migration does)
    const documents = db.prepare(`
      SELECT *
      FROM documents
      WHERE trip_id = ?
        AND (is_personal = 0 OR is_personal IS NULL OR uploaded_by = ?)
      ORDER BY created_at DESC
    `).all(tripId, userId);

    return res.status(200).json({ documents });
  } catch (error) {
    console.error('Get all trip documents error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getQuotaStatus,
  uploadDocument,
  createLinkDocument,
  getDocument,
  deleteDocument,
  downloadDocument,
  viewDocument,
  getDocumentsByReference,
  getAllTripDocuments,
  updateDocument,
  checkDocumentPermission
};