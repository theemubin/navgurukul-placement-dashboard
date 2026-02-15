const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

// Check if Cloudinary credentials exist
const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

let storage;

// Debug Cloudinary Config
if (useCloudinary) {
  console.log('Cloudinary Config Found:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? '***' : 'MISSING',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '***' : 'MISSING'
  });

  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  // Configure Cloudinary Storage
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: (req, file) => {
        if (file.fieldname === 'resume') return 'placements/resumes';
        if (file.fieldname === 'avatar') return 'placements/avatars';
        if (file.fieldname === 'heroImage') return 'placements/hero_images';
        return 'placements/documents';
      },
      // use resource_type: 'auto' to support PDFs etc.
      resource_type: 'auto',
      public_id: (req, file) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        return file.fieldname + '-' + uniqueSuffix;
      }
    },
  });
  console.log('Using Cloudinary Storage for uploads');
} else {
  // Fallback to Local Disk Storage
  console.log('Using Local Disk Storage for uploads (Cloudinary credentials missing)');

  // Ensure upload directories exist
  const uploadDirs = ['uploads/resumes', 'uploads/avatars', 'uploads/documents', 'uploads/hero_images'];
  const uploadsRoot = path.join(__dirname, '../'); // Prepare absolute path base

  uploadDirs.forEach(dir => {
    const absoluteDir = path.join(uploadsRoot, dir);
    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }
  });

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Resolve absolute path to uploads directory (backend/uploads)
      const uploadsRoot = path.join(__dirname, '../uploads');
      let uploadPath = path.join(uploadsRoot, 'documents');

      if (file.fieldname === 'resume') {
        uploadPath = path.join(uploadsRoot, 'resumes');
      } else if (file.fieldname === 'avatar') {
        uploadPath = path.join(uploadsRoot, 'avatars');
      } else if (file.fieldname === 'heroImage') {
        uploadPath = path.join(uploadsRoot, 'hero_images');
      }

      // Ensure directory exists
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
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
