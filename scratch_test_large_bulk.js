require('dotenv').config();
const mongoose = require('mongoose');
const Weather = require('./models/Weather');
const UploadLog = require('./models/UploadLog');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  const validRecords = [];
  const uploadLogId = new mongoose.Types.ObjectId();
  for (let i = 0; i < 3105; i++) {
    validRecords.push({
      location: 'Test City ' + (i % 10), // 10 cities
      district: 'Test Dist',
      province: 'Test Prov',
      latitude: 0,
      longitude: 0,
      date: new Date(new Date('2020-01-01').getTime() + i * 86400000), // unique dates
      temperature: 20,
      humidity: 50,
      rainfall: 0,
      windSpeed: 0,
      pressure: 1000,
      source: 'Test',
      uploadLogId: uploadLogId
    });
  }

  // First insert
  try {
    const res1 = await Weather.insertMany(validRecords, { ordered: false });
    console.log('First insert count:', res1.length);
  } catch (e) {
    console.log('First insert threw (should not happen if DB is clean for these records)', e.name);
  }

  // Second insert (ALL DUPLICATES)
  const startTime = Date.now();
  try {
    const result = await Weather.insertMany(validRecords, {
      ordered: false,
      rawResult: true,
    });
    console.log('Second insert count:', result.insertedCount);
  } catch (bulkErr) {
    if (bulkErr.code === 11000 || bulkErr.name === 'MongoBulkWriteError') {
      const insertedCount = bulkErr.result?.nInserted || 0;
      const duplicateCount = validRecords.length - insertedCount;
      console.log(`Caught MongoBulkWriteError in ${Date.now() - startTime}ms. Inserted:`, insertedCount, 'Dupes:', duplicateCount);
    } else {
      console.error('Unknown error:', bulkErr);
    }
  }

  // Clean up
  await Weather.deleteMany({ source: 'Test' });

  mongoose.disconnect();
}

run().catch(console.error);
