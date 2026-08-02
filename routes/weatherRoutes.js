/**
 * routes/weatherRoutes.js — Weather data routes
 */

const express = require('express');
const router = express.Router();
const {
  getWeather,
  getWeatherByLocation,
  getStatistics,
  deleteWeather,
  deleteByLocation,
  replicateDataset,
  getLocations,
} = require('../controllers/weatherController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

// ── Public Routes ─────────────────────────────────────────────────────────────
// GET /api/weather
router.get('/', getWeather);

// GET /api/weather/statistics
router.get('/statistics', getStatistics);

// GET /api/weather/locations
router.get('/locations', getLocations);

// GET /api/weather/location/:location
router.get('/location/:location', getWeatherByLocation);

// ── Admin Only Routes ─────────────────────────────────────────────────────────
// DELETE /api/weather/location/:location  — delete all records for a location
router.delete('/location/:location', protect, restrictTo('admin'), deleteByLocation);

// DELETE /api/weather/:id  — delete single record
router.delete('/:id', protect, restrictTo('admin'), deleteWeather);

// POST /api/weather/replicate
router.post('/replicate', protect, restrictTo('admin'), replicateDataset);

module.exports = router;
