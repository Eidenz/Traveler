// server/routes/documents.js
const express = require('express');
const { body } = require('express-validator');
const { 
  uploadDocument,
  getDocument,
  deleteDocument,
  downloadDocument,
  viewDocument,
  getDocumentsByReference
} = require('../controllers/documentController');
const { authenticate, requireEditAccess, checkTripAccess } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

const router = express.Router();

// Authentication required for most document routes
router.use(authenticate);

// Upload a document
router.post(
  '/',
  authenticate,
  upload.single('document'),
  [
    body('reference_type').isIn(['trip', 'transportation', 'lodging', 'activity'])
      .withMessage('Valid reference type is required'),
    body('reference_id').isNumeric().withMessage('Valid reference ID is required')
  ],
  uploadDocument
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

module.exports = router;