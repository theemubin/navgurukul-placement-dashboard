const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

// Resolve Cloudinary Credentials (mandatory, no local fallback)
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    'Cloudinary configuration error: CLOUDINARY_NAME (or CLOUDINARY_CLOUD_NAME), ' +
    'CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be set. ' +
    'Local disk storage fallback is disabled.'
  );
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

// Debug Cloudinary Config (without exposing secrets)
console.log('Cloudinary Configured:', {
  cloud_name: cloudName,
  api_key: apiKey ? '***' : 'MISSING',
  api_secret: apiSecret ? '***' : 'MISSING'
});

// Configure Cloudinary Storage (Cloudinary only)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

    if (file.fieldname === 'avatar') {
      return {
        folder: 'placements/avatars',
        resource_type: 'image',
        public_id: `avatar-${uniqueSuffix}`
      };
    }

    if (file.fieldname === 'heroImage') {
      return {
        folder: 'placements/hero_images',
        resource_type: 'image',
        public_id: `heroImage-${uniqueSuffix}`
      };
    }

    if (file.fieldname === 'resume') {
      const ext = path.extname(file.originalname) || '.pdf';
      return {
        folder: 'placements/resumes',
        resource_type: 'raw',
        public_id: `resume-${uniqueSuffix}${ext}`
      };
    }

    // Default fallback for any other documents
    const ext = path.extname(file.originalname) || '';
    return {
      folder: 'placements/documents',
      resource_type: 'raw',
      public_id: `document-${uniqueSuffix}${ext}`
    };
  }
});

console.log('Using Cloudinary Storage for uploads (disk storage disabled)');


// File filter (same as before)
const fileFilter = (req, file, cb) => {
  console.log(`Processing upload: field=${file.fieldname}, mimetype=${file.mimetype}, name=${file.originalname}`);

  if (file.fieldname === 'resume') {
    // Allow PDF, DOC, DOCX for resumes
    if (file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      console.error('Upload rejected: Invalid resume format', file.mimetype);
      cb(new Error('Resume must be PDF, DOC, or DOCX'), false);
    }
  } else if (file.fieldname === 'avatar' || file.fieldname === 'heroImage') {
    // Allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      console.error('Upload rejected: Invalid image format', file.mimetype);
      cb(new Error('File must be an image'), false);
    }
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = upload;
