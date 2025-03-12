// server/routes/documents.js
const express = require('express');
const { body } = require('express-validator');
const { 
  uploadDocument,
  getDocument,
  deleteDocument,
  downloadDocument
} = require('../controllers/documentController');
const { authenticate, requireEditAccess } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

const router = express.Router();

// Authentication required for all document routes
router.use(authenticate);

// Upload a document
router.post(
  '/',
  upload.single('document'),
  [
    body('reference_type').isIn(['trip', 'transportation', 'lodging', 'activity'])
      .withMessage('Valid reference type is required'),
    body('reference_id').isNumeric().withMessage('Valid reference ID is required')
  ],
  uploadDocument
);

// Get a document
router.get('/:documentId', getDocument);

// Download a document
router.get('/:documentId/download', downloadDocument);

// Delete a document
router.delete('/:documentId', requireEditAccess, deleteDocument);

module.exports = router;