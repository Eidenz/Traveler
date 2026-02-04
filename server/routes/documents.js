const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const fs = require('fs');
const {
  uploadDocument,
  getDocument,
  deleteDocument,
  downloadDocument,
  viewDocument,
  getDocumentsByReference,
  updateDocument
} = require('../controllers/documentController');
const { authenticate, requireEditAccess } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

const router = express.Router();

// Middleware function to handle multer errors specifically for the upload route
const handleUpload = (req, res, next) => {
  const uploader = upload.single('document'); // Get the multer middleware instance

  uploader(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading (e.g., file size limit)
      console.error('Multer Error:', err);
      let message = 'File upload error.';
      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'File is too large. Maximum size allowed is 10MB.';
      }
      // Add more specific Multer error codes here if needed
      return res.status(400).json({ message: message, code: err.code });
    } else if (err) {
      // A custom error from fileFilter or other non-Multer error during upload
      console.error('File Filter/Upload Error:', err);
      // Check if it's our custom file type error
      if (err.message && err.message.startsWith('Invalid file type')) {
        return res.status(400).json({ message: err.message });
      }
      // Otherwise, treat as a generic server error during upload
      return res.status(500).json({ message: 'An unexpected error occurred during file upload.' });
    }
    // No error, proceed to the next middleware/route handler
    next();
  });
};

// Authentication required for most document routes
router.use(authenticate);

// Upload a document
router.post(
  '/',
  handleUpload,
  [
    body('reference_type').isIn(['trip', 'transport', 'transportation', 'lodging', 'activity'])
      .withMessage('Valid reference type is required'),
    body('reference_id').notEmpty().withMessage('Valid reference ID is required')
  ],
  (req, res, next) => {
    // Check validation results *before* calling the controller
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // If file was uploaded but validation failed, delete the uploaded file
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting uploaded file after validation failure:", unlinkErr);
        });
      }
      return res.status(400).json({ errors: errors.array() });
    }
    // Proceed to controller if everything is okay
    uploadDocument(req, res, next); // Call the actual controller function
  }
);

// Get a document's metadata
router.get('/:documentId', getDocument);

// Download a document (with attachment header)
router.get('/:documentId/download', downloadDocument);

// View a document (for inline browser viewing)
router.get('/:documentId/view', viewDocument);

// Get all documents for a specific reference
router.get('/reference/:reference_type/:reference_id', getDocumentsByReference);

// Delete a document
router.delete('/:documentId', requireEditAccess, deleteDocument);

// Update a document (e.g. link/unlink)
router.put('/:documentId', requireEditAccess, updateDocument);

module.exports = router;