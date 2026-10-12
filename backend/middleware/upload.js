const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Resolve Cloudinary Credentials
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const hasCloudinaryCredentials = Boolean(cloudName && apiKey && apiSecret);

const uploadsRoot = path.join(__dirname, '..', 'uploads');
const ensureUploadDirectory = (folderPath) => {
  fs.mkdirSync(folderPath, { recursive: true });
};

const getRelativeUploadPath = (fieldname) => {
  if (fieldname === 'avatar') return 'avatars';
  if (fieldname === 'heroImage') return 'hero_images';
  if (fieldname === 'resume') return 'resumes';
  if (fieldname === 'document' || fieldname === 'placementDocument') return 'post-placement-documents';
  return 'documents';
};

let storage;

if (hasCloudinaryCredentials) {
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

  storage = new CloudinaryStorage({
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

      if (file.fieldname === 'document' || file.fieldname === 'placementDocument') {
        const ext = path.extname(file.originalname) || '';
        return {
          folder: 'placements/post-placement-documents',
          resource_type: 'raw',
          public_id: `placement-document-${uniqueSuffix}${ext}`
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

  console.log('Using Cloudinary Storage for uploads');
} else {
  console.warn('[Uploads] Cloudinary credentials are missing; using local disk storage fallback');

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const relativeFolder = getRelativeUploadPath(file.fieldname);
      const destination = path.join(uploadsRoot, relativeFolder);
      ensureUploadDirectory(destination);
      cb(null, destination);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname) || '';
      const baseName = file.fieldname === 'avatar'
        ? `avatar-${uniqueSuffix}`
        : file.fieldname === 'heroImage'
          ? `heroImage-${uniqueSuffix}`
          : file.fieldname === 'resume'
            ? `resume-${uniqueSuffix}`
            : file.fieldname === 'document' || file.fieldname === 'placementDocument'
              ? `placement-document-${uniqueSuffix}`
              : `document-${uniqueSuffix}`;

      cb(null, `${baseName}${ext}`);
    }
  });
}


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
  } else if (file.fieldname === 'document' || file.fieldname === 'placementDocument') {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype.startsWith('image/')
    ) {
      cb(null, true);
    } else {
      console.error('Upload rejected: Invalid document format', file.mimetype);
      cb(new Error('Document must be PDF, DOC, DOCX, or an image'), false);
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
