/**
 * transformMongoExport.js
 * Detects and transforms MongoDB sensor export format into the
 * platform's standard weather record format.
 *
 * Sensor export fields:
 *   timestamp.$date     → date
 *   coordinates[0]      → latitude
 *   coordinates[1]      → longitude
 *   pressure (Pa)       → pressure (hPa)  ÷ 100
 *   precipitation       → rainfall
 *   percentage_light_intensity → lightIntensity (stored as extra)
 *   temperature, humidity → unchanged
 *   windSpeed           → 0 (not in sensor data)
 *
 * Location is resolved from GPS coordinates via a lookup table
 * of known Sri Lankan weather stations.
 */

// ── Known Sri Lankan station coordinate lookup ──────────────────────────────
// Format: { lat, lng, toleranceDeg, location, district, province }
const STATION_LOOKUP = [
  { lat: 6.9271, lng: 79.8612, tol: 0.5, location: 'Colombo', district: 'Colombo', province: 'Western Province' },
  { lat: 6.9642, lng: 80.7849, tol: 0.1, location: 'Nuwara Eliya', district: 'Nuwara Eliya', province: 'Central Province' },
  { lat: 7.2906, lng: 80.6337, tol: 0.3, location: 'Kandy', district: 'Kandy', province: 'Central Province' },
  { lat: 6.0535, lng: 80.2210, tol: 0.3, location: 'Galle', district: 'Galle', province: 'Southern Province' },
  { lat: 9.6615, lng: 80.0255, tol: 0.3, location: 'Jaffna', district: 'Jaffna', province: 'Northern Province' },
  { lat: 5.9549, lng: 80.5550, tol: 0.3, location: 'Matara', district: 'Matara', province: 'Southern Province' },
  { lat: 7.4863, lng: 80.3647, tol: 0.3, location: 'Kurunegala', district: 'Kurunegala', province: 'North Western Province' },
  { lat: 8.3114, lng: 80.4037, tol: 0.3, location: 'Anuradhapura', district: 'Anuradhapura', province: 'North Central Province' },
  { lat: 6.6828, lng: 81.0536, tol: 0.3, location: 'Badulla', district: 'Badulla', province: 'Uva Province' },
  { lat: 6.6828, lng: 80.3992, tol: 0.3, location: 'Ratnapura', district: 'Ratnapura', province: 'Sabaragamuwa Province' },
  { lat: 7.9403, lng: 81.0188, tol: 0.3, location: 'Polonnaruwa', district: 'Polonnaruwa', province: 'North Central Province' },
  { lat: 7.8731, lng: 80.6517, tol: 0.3, location: 'Dambulla', district: 'Matale', province: 'Central Province' },
  { lat: 8.5874, lng: 81.2152, tol: 0.3, location: 'Trincomalee', district: 'Trincomalee', province: 'Eastern Province' },
  { lat: 7.7102, lng: 81.6924, tol: 0.3, location: 'Batticaloa', district: 'Batticaloa', province: 'Eastern Province' },
  { lat: 6.8498, lng: 81.3319, tol: 0.3, location: 'Monaragala', district: 'Monaragala', province: 'Uva Province' },
];

/**
 * Resolves GPS coordinates to a Sri Lankan location record.
 * Returns the closest match within tolerance, or a fallback.
 */
const resolveLocation = (lat, lng) => {
  let best = null;
  let bestDist = Infinity;

  for (const station of STATION_LOOKUP) {
    const dist = Math.sqrt(
      Math.pow(lat - station.lat, 2) + Math.pow(lng - station.lng, 2)
    );
    if (dist < bestDist && dist <= station.tol) {
      bestDist = dist;
      best = station;
    }
  }

  if (best) return best;

  // Fallback: return generic info with coordinates
  return {
    location: `Station (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    district: 'Unknown',
    province: 'Unknown',
  };
};

/**
 * Detects if an array is in MongoDB sensor export format.
 * Checks for the presence of $date / $oid markers.
 */
const isMongoExportFormat = (records) => {
  if (!Array.isArray(records) || records.length === 0) return false;
  const sample = records[0];
  return !!(
    (sample.timestamp && sample.timestamp.$date) ||
    (sample._id && sample._id.$oid) ||
    (sample.createAt && sample.createAt.$date)
  );
};

/**
 * Transforms a single MongoDB sensor export record into the platform format.
 */
const transformRecord = (raw) => {
  // ── Extract date ──────────────────────────────────────────────
  const dateRaw = raw.timestamp?.$date || raw.createAt?.$date;
  const date = dateRaw ? new Date(dateRaw) : null;

  // ── Extract coordinates ───────────────────────────────────────
  const lat = Array.isArray(raw.coordinates) ? raw.coordinates[0] : null;
  const lng = Array.isArray(raw.coordinates) ? raw.coordinates[1] : null;

  // ── Resolve location ──────────────────────────────────────────
  const locationInfo =
    lat !== null && lng !== null
      ? resolveLocation(lat, lng)
      : { location: 'Unknown', district: 'Unknown', province: 'Unknown' };

  // ── Convert pressure: Pa → hPa ────────────────────────────────
  // Raw sensor values like 81089 are in Pascals; divide by 100 for hPa.
  // Standard hPa range is ~800–1100; if already in that range, keep as-is.
  let pressure = raw.pressure != null ? raw.pressure : null;
  if (pressure !== null && pressure > 1200) {
    pressure = parseFloat((pressure / 100).toFixed(2));
  }

  return {
    location: locationInfo.location,
    district: locationInfo.district,
    province: locationInfo.province,
    latitude: lat,
    longitude: lng,
    date: date,
    temperature: raw.temperature != null ? parseFloat(raw.temperature) : null,
    humidity: raw.humidity != null ? parseFloat(raw.humidity) : null,
    rainfall: raw.precipitation != null ? parseFloat(raw.precipitation) : 0,
    windSpeed: raw.windSpeed != null ? parseFloat(raw.windSpeed) : 0,
    pressure: pressure,
    source: raw.metadata?.soruce || raw.metadata?.source || 'Sensor Upload',
    // Extra sensor fields stored for reference
    lightIntensity: raw.percentage_light_intensity != null
      ? parseFloat(raw.percentage_light_intensity)
      : null,
  };
};

/**
 * Transforms an entire MongoDB export array to platform format.
 * Deduplicates entries by (location + date) using a Set.
 * Returns { transformed: [...], skipped: number }
 */
const transformMongoExport = (records) => {
  const seen = new Set();
  const transformed = [];
  let skipped = 0;

  for (const raw of records) {
    const rec = transformRecord(raw);

    // Skip records with missing critical fields or invalid dates
    if (!rec.date || isNaN(rec.date.getTime()) || !rec.location || rec.temperature == null) {
      skipped++;
      continue;
    }

    // Deduplicate by location + timestamp (minute-level precision)
    const key = `${rec.location}::${rec.date.toISOString()}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    transformed.push(rec);
  }

  return { transformed, skipped };
};

module.exports = { isMongoExportFormat, transformMongoExport, resolveLocation };
