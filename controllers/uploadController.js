/**
 * controllers/uploadController.js — JSON file upload and ingestion logic
 * Validates, parses, and imports weather data into MongoDB.
 */

const fs = require('fs');
const path = require('path');
const Weather = require('../models/Weather');
const UploadLog = require('../models/UploadLog');
const { validateWeatherRecord } = require('../utils/validator');
const { isMongoExportFormat, transformMongoExport } = require('../utils/transformMongoExport');

/**
 * @desc    Upload and import a JSON weather data file
 * @route   POST /api/upload
 * @access  Admin
 */
const uploadWeatherFile = async (req, res) => {
  const filePath = req.file ? req.file.path : null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // ── Read and parse JSON ───────────────────────────────────────────────────
    let rawData;
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      rawData = JSON.parse(fileContent);
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format. Please upload a valid JSON file.',
      });
    }

    // Support both array and wrapped { data: [...] }
    let records = Array.isArray(rawData) ? rawData : rawData.data || rawData.records;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'JSON must contain an array of weather records.',
      });
    }

    // ── Auto-detect and transform MongoDB sensor export format ────────────────
    let transformSkipped = 0;
    let formatDetected = 'standard';

    if (isMongoExportFormat(records)) {
      formatDetected = 'mongo-sensor-export';
      const { transformed, skipped } = transformMongoExport(records);
      console.log(
        `📦 MongoDB export detected: ${records.length} raw → ${transformed.length} transformed, ${skipped} skipped (duplicates/invalid)`
      );
      records = transformed;
      transformSkipped = skipped;

      if (records.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid records could be extracted from the sensor export file.',
        });
      }
    }

    // ── Validate and prepare records ──────────────────────────────────────────
    const errors = [];
    const validRecords = [];

    records.forEach((record, index) => {
      const { isValid, error, cleaned } = validateWeatherRecord(record, index);
      if (isValid) {
        validRecords.push(cleaned);
      } else {
        errors.push({ row: index + 1, message: error });
      }
    });

    if (validRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid records found in the file.',
        errors,
      });
    }

    // ── Bulk insert with duplicate handling ───────────────────────────────────
    let insertedCount = 0;
    let duplicateCount = 0;
    const insertErrors = [];

    // Use insertMany with ordered:false so duplicates don't block others
    try {
      const result = await Weather.insertMany(validRecords, {
        ordered: false,
        rawResult: true,
      });
      insertedCount = result.insertedCount || validRecords.length;
    } catch (bulkErr) {
      if (bulkErr.code === 11000 || bulkErr.name === 'MongoBulkWriteError') {
        // Some duplicates; partial success
        insertedCount = bulkErr.result?.nInserted || 0;
        duplicateCount = validRecords.length - insertedCount - insertErrors.length;
      } else {
        throw bulkErr;
      }
    }

    // ── Detect location from first valid record ───────────────────────────────
    const detectedLocation = validRecords[0]?.location || 'Unknown';

    // ── Store upload log ──────────────────────────────────────────────────────
    const logStatus =
      errors.length === 0 && duplicateCount === 0
        ? 'success'
        : insertedCount > 0
        ? 'partial'
        : 'failed';

    await UploadLog.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      uploadedBy: req.user._id,
      recordCount: records.length,
      insertedCount,
      duplicateCount,
      errorCount: errors.length,
      status: logStatus,
      location: detectedLocation,
      validationErrors: [...errors, ...insertErrors].slice(0, 50), // Cap stored errors at 50
      fileSize: req.file.size,
    });

    // ── Cleanup temp file ─────────────────────────────────────────────────────
    fs.unlinkSync(filePath);

    res.status(201).json({
      success: true,
      message: `Upload complete. Inserted ${insertedCount} record(s).`,
      data: {
        formatDetected,
        totalInFile: records.length + transformSkipped,
        transformSkipped,
        validRecords: validRecords.length,
        insertedCount,
        duplicateCount,
        errorCount: errors.length,
        location: detectedLocation,
        errors: errors.slice(0, 10), // Show first 10 errors only
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Cleanup file on error
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ success: false, message: 'Server error during file upload.' });
  }
};

/**
 * @desc    Get upload history
 * @route   GET /api/upload/history
 * @access  Admin
 */
const getUploadHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      UploadLog.find()
        .populate('uploadedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      UploadLog.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: logs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching upload history.' });
  }
};



/**
 * @desc    Delete an upload log entry + all weather records it created
 * @route   DELETE /api/upload/:id
 * @access  Admin
 * Strategy: delete weather records for the same location within ±24h of the upload time
 */
const deleteUploadLog = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await UploadLog.findById(id);

    if (!log) {
      return res.status(404).json({ success: false, message: 'Upload log not found.' });
    }

    // Time window: records created within 48 hours of the upload
    const uploadTime = new Date(log.createdAt);
    const windowStart = new Date(uploadTime.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd   = new Date(uploadTime.getTime() + 24 * 60 * 60 * 1000);

    let deletedWeatherCount = 0;

    // Delete weather records for this location within the time window
    if (log.location && log.location !== 'Unknown') {
      const result = await Weather.deleteMany({
        location: { $regex: new RegExp(`^${log.location.trim()}$`, 'i') },
        createdAt: { $gte: windowStart, $lte: windowEnd },
      });
      deletedWeatherCount = result.deletedCount;
    }

    // Delete the upload log entry itself
    await UploadLog.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Upload log deleted. Removed ${deletedWeatherCount} associated weather record(s).`,
      deletedWeatherCount,
      location: log.location,
    });
  } catch (error) {
    console.error('Delete upload log error:', error);
    res.status(500).json({ success: false, message: 'Error deleting upload log.' });
  }
};

module.exports = { uploadWeatherFile, getUploadHistory, deleteUploadLog };
