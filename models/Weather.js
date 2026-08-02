/**
 * models/Weather.js — Weather time-series data schema
 * Stores one record per location per date.
 * Unique compound index on (location + date) prevents duplicates.
 */

const mongoose = require('mongoose');

const weatherSchema = new mongoose.Schema(
  {
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
    },
    province: {
      type: String,
      required: [true, 'Province is required'],
      trim: true,
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be >= -90'],
      max: [90, 'Latitude must be <= 90'],
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be >= -180'],
      max: [180, 'Longitude must be <= 180'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    temperature: {
      type: Number,
      required: [true, 'Temperature is required'],
      min: [-50, 'Temperature must be >= -50°C'],
      max: [60, 'Temperature must be <= 60°C'],
    },
    humidity: {
      type: Number,
      required: [true, 'Humidity is required'],
      min: [0, 'Humidity must be >= 0%'],
      max: [100, 'Humidity must be <= 100%'],
    },
    rainfall: {
      type: Number,
      required: [true, 'Rainfall is required'],
      min: [0, 'Rainfall must be >= 0mm'],
    },
    windSpeed: {
      type: Number,
      required: [true, 'Wind speed is required'],
      min: [0, 'Wind speed must be >= 0 km/h'],
    },
    pressure: {
      type: Number,
      required: [true, 'Pressure is required'],
      min: [800, 'Pressure must be >= 800 hPa'],
      max: [1100, 'Pressure must be <= 1100 hPa'],
    },
    source: {
      type: String,
      default: 'Manual Upload',
      trim: true,
    },
    isReplicated: {
      type: Boolean,
      default: false,
    },
    replicatedFrom: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound unique index: one record per location per date ───────────────────
weatherSchema.index({ location: 1, date: 1 }, { unique: true });

// ── Index for fast searches ───────────────────────────────────────────────────
weatherSchema.index({ district: 1 });
weatherSchema.index({ province: 1 });
weatherSchema.index({ date: -1 });
weatherSchema.index({ location: 1, date: -1 });

module.exports = mongoose.model('Weather', weatherSchema);
