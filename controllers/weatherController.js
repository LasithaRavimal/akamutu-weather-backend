/**
 * controllers/weatherController.js — Weather data CRUD + statistics + replication
 */

const Weather = require('../models/Weather');
const { replicateWeatherData } = require('../utils/replicator');

/**
 * @desc    Get all weather records with pagination, search, and filters
 * @route   GET /api/weather
 * @access  Public
 */
const getWeather = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      location,
      district,
      province,
      startDate,
      endDate,
      minTemp,
      maxTemp,
      minRainfall,
      maxRainfall,
      minHumidity,
      maxHumidity,
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query;

    // Build filter object dynamically
    const filter = {};

    if (location) filter.location = { $regex: location, $options: 'i' };
    if (district) filter.district = { $regex: district, $options: 'i' };
    if (province) filter.province = { $regex: province, $options: 'i' };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (minTemp !== undefined || maxTemp !== undefined) {
      filter.temperature = {};
      if (minTemp !== undefined) filter.temperature.$gte = parseFloat(minTemp);
      if (maxTemp !== undefined) filter.temperature.$lte = parseFloat(maxTemp);
    }

    if (minRainfall !== undefined || maxRainfall !== undefined) {
      filter.rainfall = {};
      if (minRainfall !== undefined) filter.rainfall.$gte = parseFloat(minRainfall);
      if (maxRainfall !== undefined) filter.rainfall.$lte = parseFloat(maxRainfall);
    }

    if (minHumidity !== undefined || maxHumidity !== undefined) {
      filter.humidity = {};
      if (minHumidity !== undefined) filter.humidity.$gte = parseFloat(minHumidity);
      if (maxHumidity !== undefined) filter.humidity.$lte = parseFloat(maxHumidity);
    }

    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      Weather.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)),
      Weather.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error('Get weather error:', error);
    res.status(500).json({ success: false, message: 'Error fetching weather data.' });
  }
};

/**
 * @desc    Get weather records for a specific location
 * @route   GET /api/weather/location/:location
 * @access  Public
 */
const getWeatherByLocation = async (req, res) => {
  try {
    const { location } = req.params;
    const { limit = 365 } = req.query;

    const records = await Weather.find({
      location: { $regex: location, $options: 'i' },
    })
      .sort({ date: -1 })
      .limit(parseInt(limit));

    if (!records.length) {
      return res.status(404).json({
        success: false,
        message: `No weather data found for location: ${location}`,
      });
    }

    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching location data.' });
  }
};

/**
 * @desc    Get platform-wide statistics
 * @route   GET /api/weather/statistics
 * @access  Public
 */
const getStatistics = async (req, res) => {
  try {
    const [aggregateStats, locationStats, monthlyStats, provinceStats] = await Promise.all([
      // Overall averages
      Weather.aggregate([
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            avgTemperature: { $avg: '$temperature' },
            avgHumidity: { $avg: '$humidity' },
            avgRainfall: { $avg: '$rainfall' },
            avgWindSpeed: { $avg: '$windSpeed' },
            avgPressure: { $avg: '$pressure' },
            maxTemperature: { $max: '$temperature' },
            minTemperature: { $min: '$temperature' },
            maxRainfall: { $max: '$rainfall' },
          },
        },
      ]),
      // Per-location averages
      Weather.aggregate([
        {
          $group: {
            _id: '$location',
            district: { $first: '$district' },
            province: { $first: '$province' },
            latitude: { $first: '$latitude' },
            longitude: { $first: '$longitude' },
            count: { $sum: 1 },
            avgTemperature: { $avg: '$temperature' },
            avgHumidity: { $avg: '$humidity' },
            avgRainfall: { $avg: '$rainfall' },
            avgWindSpeed: { $avg: '$windSpeed' },
            latestDate: { $max: '$date' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Monthly averages (all locations combined)
      Weather.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
            },
            avgTemperature: { $avg: '$temperature' },
            avgHumidity: { $avg: '$humidity' },
            avgRainfall: { $avg: '$rainfall' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 24 },
      ]),
      // Province-level stats
      Weather.aggregate([
        {
          $group: {
            _id: '$province',
            locations: { $addToSet: '$location' },
            avgTemperature: { $avg: '$temperature' },
            avgRainfall: { $avg: '$rainfall' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const totalLocations = locationStats.length;

    res.status(200).json({
      success: true,
      data: {
        overview: aggregateStats[0] || {},
        totalLocations,
        locations: locationStats,
        monthly: monthlyStats,
        provinces: provinceStats,
      },
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics.' });
  }
};

/**
 * @desc    Delete a single weather record by ID
 * @route   DELETE /api/weather/:id
 * @access  Admin
 */
const deleteWeather = async (req, res) => {
  try {
    const record = await Weather.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }
    res.status(200).json({ success: true, message: 'Record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting record.' });
  }
};

/**
 * @desc    Replicate dataset to multiple Sri Lankan locations
 * @route   POST /api/weather/replicate
 * @access  Admin
 */
const replicateDataset = async (req, res) => {
  try {
    const { sourceLocation, targetLocations } = req.body;

    if (!sourceLocation) {
      return res.status(400).json({ success: false, message: 'Source location is required.' });
    }

    // Fetch source data
    const sourceData = await Weather.find({
      location: { $regex: sourceLocation, $options: 'i' },
    }).sort({ date: 1 });

    if (!sourceData.length) {
      return res.status(404).json({
        success: false,
        message: `No data found for source location: ${sourceLocation}`,
      });
    }

    // Replicate to target locations
    const results = await replicateWeatherData(sourceData, targetLocations);

    res.status(200).json({
      success: true,
      message: `Dataset replicated to ${results.successCount} location(s).`,
      data: results,
    });
  } catch (error) {
    console.error('Replication error:', error);
    res.status(500).json({ success: false, message: 'Error during replication.' });
  }
};

/**
 * @desc    Get distinct locations list
 * @route   GET /api/weather/locations
 * @access  Public
 */
const getLocations = async (req, res) => {
  try {
    const locations = await Weather.aggregate([
      {
        $group: {
          _id: '$location',
          district: { $first: '$district' },
          province: { $first: '$province' },
          latitude: { $first: '$latitude' },
          longitude: { $first: '$longitude' },
          count: { $sum: 1 },
          latestDate: { $max: '$date' },
          avgTemperature: { $avg: '$temperature' },
          avgHumidity: { $avg: '$humidity' },
          avgRainfall: { $avg: '$rainfall' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({ success: true, count: locations.length, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching locations.' });
  }
};

/**
 * @desc    Delete ALL weather records for a given location
 * @route   DELETE /api/weather/location/:location
 * @access  Admin
 */
const deleteByLocation = async (req, res) => {
  try {
    const { location } = req.params;
    if (!location || location.trim() === '') {
      return res.status(400).json({ success: false, message: 'Location name is required.' });
    }

    const result = await Weather.deleteMany({
      location: { $regex: new RegExp(`^${location.trim()}$`, 'i') },
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `No records found for location "${location}".`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} record(s) for location "${location}".`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Delete by location error:', error);
    res.status(500).json({ success: false, message: 'Error deleting records by location.' });
  }
};

module.exports = {
  getWeather,
  getWeatherByLocation,
  getStatistics,
  deleteWeather,
  deleteByLocation,
  replicateDataset,
  getLocations,
};

