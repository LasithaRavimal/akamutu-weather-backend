/**
 * models/UploadLog.js — Tracks file upload history and metadata
 */

const mongoose = require('mongoose');

const uploadLogSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recordCount: {
      type: Number,
      default: 0,
    },
    insertedCount: {
      type: Number,
      default: 0,
    },
    duplicateCount: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['success', 'partial', 'failed'],
      default: 'success',
    },
    location: {
      type: String,
      default: '',
    },
    validationErrors: [
      {
        row: Number,
        message: String,
      },
    ],
    fileSize: {
      type: Number, // bytes
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UploadLog', uploadLogSchema);
