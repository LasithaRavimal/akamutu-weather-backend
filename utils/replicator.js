/**
 * utils/replicator.js — Dataset replication engine
 * Takes weather data from a source location and generates statistically
 * randomized realistic variants for other Sri Lankan cities.
 */

const Weather = require('../models/Weather');

// Sri Lankan location profiles with realistic geo and climate adjustments
const SRI_LANKA_LOCATIONS = {
  Kandy: {
    district: 'Kandy',
    province: 'Central Province',
    latitude: 7.2906,
    longitude: 80.6337,
    // Climate deltas relative to a coastal baseline (Colombo-like)
    tempDelta: [-2.5, -1.5],      // Cooler (highland)
    humidityDelta: [0, 5],
    rainfallMultiplier: [1.1, 1.4],
    windDelta: [-2, 2],
    pressureDelta: [-8, -5],       // Higher altitude → lower pressure
  },
  Kurunegala: {
    district: 'Kurunegala',
    province: 'North Western Province',
    latitude: 7.4818,
    longitude: 80.3609,
    tempDelta: [0, 1.5],
    humidityDelta: [-5, 0],
    rainfallMultiplier: [0.6, 0.9],
    windDelta: [0, 3],
    pressureDelta: [0, 2],
  },
  Matara: {
    district: 'Matara',
    province: 'Southern Province',
    latitude: 5.9549,
    longitude: 80.5550,
    tempDelta: [0.5, 1.5],
    humidityDelta: [2, 6],
    rainfallMultiplier: [1.0, 1.3],
    windDelta: [2, 5],
    pressureDelta: [0, 1],
  },
  Jaffna: {
    district: 'Jaffna',
    province: 'Northern Province',
    latitude: 9.6615,
    longitude: 80.0255,
    tempDelta: [1.5, 3.0],        // Hotter, drier
    humidityDelta: [-10, -5],
    rainfallMultiplier: [0.3, 0.6],
    windDelta: [3, 7],
    pressureDelta: [1, 3],
  },
  Galle: {
    district: 'Galle',
    province: 'Southern Province',
    latitude: 6.0535,
    longitude: 80.2210,
    tempDelta: [0.2, 1.0],
    humidityDelta: [3, 7],
    rainfallMultiplier: [1.1, 1.5],
    windDelta: [1, 4],
    pressureDelta: [0, 1],
  },
  Badulla: {
    district: 'Badulla',
    province: 'Uva Province',
    latitude: 6.9934,
    longitude: 81.0550,
    tempDelta: [-4, -2],          // High elevation, much cooler
    humidityDelta: [3, 8],
    rainfallMultiplier: [1.2, 1.8],
    windDelta: [-1, 2],
    pressureDelta: [-12, -8],
  },
  Ratnapura: {
    district: 'Ratnapura',
    province: 'Sabaragamuwa Province',
    latitude: 6.6828,
    longitude: 80.3992,
    tempDelta: [-1.5, 0],
    humidityDelta: [5, 10],       // Very wet area
    rainfallMultiplier: [1.5, 2.2],
    windDelta: [-1, 1],
    pressureDelta: [-5, -2],
  },
  Anuradhapura: {
    district: 'Anuradhapura',
    province: 'North Central Province',
    latitude: 8.3114,
    longitude: 80.4037,
    tempDelta: [1.0, 2.5],
    humidityDelta: [-8, -3],
    rainfallMultiplier: [0.5, 0.8],
    windDelta: [1, 4],
    pressureDelta: [0, 2],
  },
  Polonnaruwa: {
    district: 'Polonnaruwa',
    province: 'North Central Province',
    latitude: 7.9403,
    longitude: 81.0188,
    tempDelta: [1.5, 3.0],
    humidityDelta: [-6, -2],
    rainfallMultiplier: [0.5, 0.8],
    windDelta: [0, 3],
    pressureDelta: [0, 2],
  },
};

/**
 * Random float between min and max (2 decimal places)
 */
const randBetween = (min, max) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(2));

/**
 * Clamp value within bounds
 */
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/**
 * Replicate weather data from source to target locations.
 * @param {Array} sourceData - Array of Weather documents from source location
 * @param {Array|null} targetLocations - Optional list of target location names. Defaults to all 9.
 */
const replicateWeatherData = async (sourceData, targetLocations = null) => {
  const targets = targetLocations && targetLocations.length > 0
    ? targetLocations
    : Object.keys(SRI_LANKA_LOCATIONS);

  const results = {
    successCount: 0,
    failedLocations: [],
    details: [],
  };

  for (const locationName of targets) {
    const profile = SRI_LANKA_LOCATIONS[locationName];
    if (!profile) {
      results.failedLocations.push(`${locationName}: Unknown location profile.`);
      continue;
    }

    try {
      // Build replicated records
      const replicatedRecords = sourceData.map((src) => {
        const tempDelta = randBetween(...profile.tempDelta);
        const humidityDelta = randBetween(...profile.humidityDelta);
        const rainfallMultiplier = randBetween(...profile.rainfallMultiplier);
        const windDelta = randBetween(...profile.windDelta);
        const pressureDelta = randBetween(...profile.pressureDelta);

        // Add small random noise (±5%) for natural variation
        const noise = (base, pct = 0.05) =>
          base * (1 + (Math.random() * 2 - 1) * pct);

        return {
          location: locationName,
          district: profile.district,
          province: profile.province,
          latitude: profile.latitude,
          longitude: profile.longitude,
          date: new Date(src.date),
          temperature: parseFloat(
            clamp(noise(src.temperature + tempDelta), -10, 50).toFixed(1)
          ),
          humidity: parseFloat(
            clamp(noise(src.humidity + humidityDelta), 10, 100).toFixed(1)
          ),
          rainfall: parseFloat(
            clamp(noise(src.rainfall * rainfallMultiplier), 0, 800).toFixed(1)
          ),
          windSpeed: parseFloat(
            clamp(noise(src.windSpeed + windDelta), 0, 150).toFixed(1)
          ),
          pressure: parseFloat(
            clamp(noise(src.pressure + pressureDelta), 900, 1050).toFixed(1)
          ),
          source: `Replicated from ${src.location}`,
          isReplicated: true,
          replicatedFrom: src.location,
        };
      });

      // Insert with duplicate tolerance
      let insertedCount = 0;
      try {
        const result = await Weather.insertMany(replicatedRecords, {
          ordered: false,
          rawResult: true,
        });
        insertedCount = result.insertedCount || replicatedRecords.length;
      } catch (bulkErr) {
        if (bulkErr.code === 11000 || bulkErr.name === 'MongoBulkWriteError') {
          insertedCount = bulkErr.result?.nInserted || 0;
        } else {
          throw bulkErr;
        }
      }

      results.successCount++;
      results.details.push({
        location: locationName,
        status: 'success',
        insertedCount,
        totalRecords: replicatedRecords.length,
      });
    } catch (err) {
      results.failedLocations.push(`${locationName}: ${err.message}`);
      results.details.push({ location: locationName, status: 'failed', error: err.message });
    }
  }

  return results;
};

module.exports = { replicateWeatherData, SRI_LANKA_LOCATIONS };
