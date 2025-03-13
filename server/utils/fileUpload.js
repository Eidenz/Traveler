// server/utils/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage for different file types
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create type-specific directories based on field name and mimetype
    let typeDir;

    console.log("type:", file.fieldname);
    
    // Check if this is a profile image upload
    if (file.fieldname === 'profile_image') {
      typeDir = path.join(uploadsDir, 'profiles');
    }
    // Check if this is a trip cover image upload
    else if (file.fieldname === 'cover_image') {
      typeDir = path.join(uploadsDir, 'trips');
    }
    // Document uploads
    else if (file.fieldname === 'document' || 
             ['.pdf','.doc','.docx','.txt'].includes(path.extname(file.originalname))) {
      typeDir = path.join(uploadsDir, 'documents');
    }
    // Any other image goes to its appropriate folder based on mimetype
    else if (file.mimetype.startsWith('image/')) {
      // Check the base URL path to determine context
      if (req.originalUrl.includes('/users')) {
        typeDir = path.join(uploadsDir, 'profiles');
      } else if (req.originalUrl.includes('/trips')) {
        typeDir = path.join(uploadsDir, 'trips');
      } else {
        typeDir = uploadsDir;
      }
    }
    // Default case for any other file type
    else {
      typeDir = uploadsDir;
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    
    cb(null, typeDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter to restrict file types
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedDocumentTypes = /pdf|doc|docx|txt/;
  
  // Check file type
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;
  
  // Check field name for profile images
  if (file.fieldname === 'profile_image') {
    if (allowedImageTypes.test(extname) || mimetype.startsWith('image/')) {
      return cb(null, true);
    }
  }
  // Check field name for trip cover images
  else if (file.fieldname === 'cover_image') {
    if (allowedImageTypes.test(extname) || mimetype.startsWith('image/')) {
      return cb(null, true);
    }
  }
  // Check field name and mimetype for documents
  else if (file.fieldname === 'document' || req.originalUrl.includes('/documents')) {
    if (allowedDocumentTypes.test(extname) || mimetype.includes('pdf') || 
        mimetype.includes('word') || mimetype.includes('text')) {
      return cb(null, true);
    }
  }
  // Default case - accept images and PDFs
  else if ((allowedImageTypes.test(extname) || mimetype.startsWith('image/')) ||
      (allowedDocumentTypes.test(extname) || mimetype.includes('pdf'))) {
    return cb(null, true);
  }
  
  cb(new Error('Invalid file type. Only allowed file types are accepted.'), false);
};

// Configure multer with our options
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  }
});

module.exports = upload;