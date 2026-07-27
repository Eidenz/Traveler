// server/utils/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create directories for specific entity types
const dirTypes = ['profiles', 'trips', 'documents', 'transportation', 'lodging', 'activities'];
dirTypes.forEach(dirType => {
  const dir = path.join(uploadsDir, dirType);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage for different file types
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create type-specific directories based on field name and mimetype
    let typeDir;

    // Check if this is a profile image upload
    if (file.fieldname === 'profile_image') {
      typeDir = path.join(uploadsDir, 'profiles');
    }
    // Check if this is a trip cover image upload
    else if (file.fieldname === 'cover_image') {
      typeDir = path.join(uploadsDir, 'trips');
    }
    // Check if this is a transportation banner image upload
    else if (file.fieldname === 'banner_image' && req.originalUrl.includes('/transportation')) {
      typeDir = path.join(uploadsDir, 'transportation');
    }
    // Check if this is a lodging banner image upload
    else if (file.fieldname === 'banner_image' && req.originalUrl.includes('/lodging')) {
      typeDir = path.join(uploadsDir, 'lodging');
    }
    // Check if this is an activity banner image upload
    else if (file.fieldname === 'banner_image' && req.originalUrl.includes('/activities')) {
      typeDir = path.join(uploadsDir, 'activities');
    }
    // Document uploads
    else if (file.fieldname === 'document' ||
      ['.pdf', '.doc', '.docx', '.txt'].includes(path.extname(file.originalname))) {
      typeDir = path.join(uploadsDir, 'documents');
    }
    // Any other image goes to its appropriate folder based on mimetype
    else if (file.mimetype.startsWith('image/')) {
      // Check the base URL path to determine context
      if (req.originalUrl.includes('/users')) {
        typeDir = path.join(uploadsDir, 'profiles');
      } else if (req.originalUrl.includes('/trips')) {
        typeDir = path.join(uploadsDir, 'trips');
      } else if (req.originalUrl.includes('/transportation')) {
        typeDir = path.join(uploadsDir, 'transportation');
      } else if (req.originalUrl.includes('/lodging')) {
        typeDir = path.join(uploadsDir, 'lodging');
      } else if (req.originalUrl.includes('/activities')) {
        typeDir = path.join(uploadsDir, 'activities');
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
    // Create unique filename. Only the extension from the original name is kept
    // (the filter has already restricted it to a safe allow-list) — the rest is
    // server-generated so a crafted name can never influence the stored path.
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter to restrict file types
//
// The extension allow-list is authoritative and the stored file always keeps a
// listed extension (see `storage.filename`). Accepting on *either* extension or
// mimetype would let `evil.html` in under a spoofed `image/png` type and get it
// served back as HTML from this origin — i.e. stored XSS.
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', ...IMAGE_EXTENSIONS];

const isAllowedExtension = (filename, allowed) =>
  allowed.includes(path.extname(filename).toLowerCase());

const fileFilter = (req, file, cb) => {
  const isImageField = ['profile_image', 'cover_image', 'banner_image'].includes(file.fieldname);
  const isDocumentField = file.fieldname === 'document' || req.originalUrl.includes('/documents');

  const allowed = isImageField
    ? IMAGE_EXTENSIONS
    : isDocumentField
      ? DOCUMENT_EXTENSIONS
      : DOCUMENT_EXTENSIONS; // default: same set as documents

  if (isAllowedExtension(file.originalname, allowed)) {
    return cb(null, true);
  }

  cb(new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`), false);
};

// Configure multer with our options
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
  }
});

module.exports = upload;