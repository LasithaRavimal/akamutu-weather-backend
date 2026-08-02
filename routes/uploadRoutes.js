/**
 * routes/uploadRoutes.js — File upload routes (admin only)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadWeatherFile, getUploadHistory, deleteUploadLog } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');

// ── Ensure uploads directory exists ──────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Multer configuration ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `weather-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/json' || path.extname(file.originalname) === '.json') {
    cb(null, true);
  } else {
    cb(new Error('Only JSON files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// ── Routes ────────────────────────────────────────────────────────────────────
// POST /api/upload
router.post(
  '/',
  protect,
  restrictTo('admin'),
  uploadLimiter,
  upload.single('file'),
  uploadWeatherFile
);

// GET /api/upload/history
router.get('/history', protect, restrictTo('admin'), getUploadHistory);

// DELETE /api/upload/:id  — delete log entry + associated weather records
router.delete('/:id', protect, restrictTo('admin'), deleteUploadLog);

// Handle multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

module.exports = router;
