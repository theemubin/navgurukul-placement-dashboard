const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for login background uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../frontend/public/login-backgrounds');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'login-bg-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|avif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, avif)'));
    }
  }
});

// Get all login background images (public endpoint - no auth needed for login page)
router.get('/', async (req, res) => {
  try {
    const bgPath = path.join(__dirname, '../../frontend/public/login-backgrounds');
    
    try {
      await fs.access(bgPath);
    } catch {
      return res.json({ success: true, backgrounds: [] });
    }

    const files = await fs.readdir(bgPath);
    const imageFiles = files.filter(file => 
      /\.(jpeg|jpg|png|webp|avif)$/i.test(file) && file !== '.gitkeep'
    );

    const backgrounds = await Promise.all(
      imageFiles.map(async (file) => {
        const filePath = path.join(bgPath, file);
        const stats = await fs.stat(filePath);
        return {
          filename: file,
          url: `/login-backgrounds/${encodeURIComponent(file)}`,
          size: stats.size,
          uploadedAt: stats.birthtime
        };
      })
    );

    backgrounds.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({ success: true, backgrounds });
  } catch (error) {
    console.error('Error fetching login backgrounds:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch login backgrounds' });
  }
});

// Upload new login background
router.post('/upload', auth, authorize('manager'), upload.single('background'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    res.json({
      success: true,
      background: {
        filename: req.file.filename,
        url: `/login-backgrounds/${encodeURIComponent(req.file.filename)}`,
        size: req.file.size,
        uploadedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error uploading login background:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
});

// Delete login background
router.delete('/:filename', auth, authorize('manager'), async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../frontend/public/login-backgrounds', filename);

    // Security check - ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    }

    await fs.unlink(filePath);
    res.json({ success: true, message: 'Background deleted successfully' });
  } catch (error) {
    console.error('Error deleting login background:', error);
    res.status(500).json({ success: false, message: 'Failed to delete background' });
  }
});

module.exports = router;
