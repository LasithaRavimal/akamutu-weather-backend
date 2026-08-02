/**
 * utils/validator.js — Weather record validation helper
 * Validates individual records before DB insertion.
 */

const REQUIRED_FIELDS = [
  'location', 'district', 'province',
  'latitude', 'longitude', 'date',
  'temperature', 'humidity', 'rainfall',
  'windSpeed', 'pressure',
];

/**
 * Validate a single weather record from uploaded JSON.
 * Returns { isValid, error, cleaned } 
 */
const validateWeatherRecord = (record, index) => {
  if (!record || typeof record !== 'object') {
    return { isValid: false, error: `Row ${index + 1}: Not a valid object.` };
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      return { isValid: false, error: `Row ${index + 1}: Missing required field '${field}'.` };
    }
  }

  // Validate date
  const parsedDate = new Date(record.date);
  if (isNaN(parsedDate.getTime())) {
    return { isValid: false, error: `Row ${index + 1}: Invalid date '${record.date}'.` };
  }

  // Validate numeric ranges
  const numericValidations = [
    { field: 'latitude', min: -90, max: 90 },
    { field: 'longitude', min: -180, max: 180 },
    { field: 'temperature', min: -50, max: 60 },
    { field: 'humidity', min: 0, max: 100 },
    { field: 'rainfall', min: 0, max: 2000 },
    { field: 'windSpeed', min: 0, max: 400 },
    { field: 'pressure', min: 800, max: 1100 },
  ];

  for (const { field, min, max } of numericValidations) {
    const val = parseFloat(record[field]);
    if (isNaN(val)) {
      return { isValid: false, error: `Row ${index + 1}: '${field}' must be a number.` };
    }
    if (val < min || val > max) {
      return {
        isValid: false,
        error: `Row ${index + 1}: '${field}' value ${val} is out of range [${min}, ${max}].`,
      };
    }
  }

  // Return cleaned/normalized record
  const cleaned = {
    location: String(record.location).trim(),
    district: String(record.district).trim(),
    province: String(record.province).trim(),
    latitude: parseFloat(record.latitude),
    longitude: parseFloat(record.longitude),
    date: parsedDate,
    temperature: parseFloat(record.temperature),
    humidity: parseFloat(record.humidity),
    rainfall: parseFloat(record.rainfall),
    windSpeed: parseFloat(record.windSpeed),
    pressure: parseFloat(record.pressure),
    source: record.source ? String(record.source).trim() : 'Manual Upload',
  };

  return { isValid: true, error: null, cleaned };
};

module.exports = { validateWeatherRecord };
