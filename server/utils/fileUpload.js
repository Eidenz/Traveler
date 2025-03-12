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
    // Create type-specific directories
    let typeDir;
    console.log(path.extname(file.originalname));
    if (['.pdf','.doc','.docx','.txt'].includes(path.extname(file.originalname))) {
      typeDir = path.join(uploadsDir, 'documents');
    } else if (['.jpeg','.jpg','.png','.gif','.webp'].includes(path.extname(file.originalname))) {
      typeDir = path.join(uploadsDir, 'trips');
    } else {
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
  
  if (req.path.includes('/documents')) {
    // Documents can be PDFs, Word docs, etc.
    if (allowedDocumentTypes.test(extname) || mimetype.includes('pdf') || 
        mimetype.includes('word') || mimetype.includes('text')) {
      return cb(null, true);
    }
  } else if (req.path.includes('/profile') || req.path.includes('/trips')) {
    // Images for profiles and trip covers
    if (allowedImageTypes.test(extname) || mimetype.startsWith('image/')) {
      return cb(null, true);
    }
  } else {
    // Default case - accept images and PDFs
    if ((allowedImageTypes.test(extname) || mimetype.startsWith('image/')) ||
        (allowedDocumentTypes.test(extname) || mimetype.includes('pdf'))) {
      return cb(null, true);
    }
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