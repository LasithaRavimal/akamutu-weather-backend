require('dotenv').config();
const mongoose = require('mongoose');
const Weather = require('./models/Weather');
const UploadLog = require('./models/UploadLog');
const { validateWeatherRecord } = require('./utils/validator');
const fs = require('fs');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  // Make some dummy data
  const validRecords = [];
  const uploadLogId = new mongoose.Types.ObjectId();
  for (let i = 0; i < 5; i++) {
    validRecords.push({
      location: 'Test City',
      district: 'Test Dist',
      province: 'Test Prov',
      latitude: 0,
      longitude: 0,
      date: new Date(`2024-01-0${i+1}`),
      temperature: 20,
      humidity: 50,
      rainfall: 0,
      windSpeed: 0,
      pressure: 1000,
      source: 'Test',
      uploadLogId: uploadLogId
    });
  }

  try {
    const result = await Weather.insertMany(validRecords, {
      ordered: false,
      rawResult: true,
    });
    console.log('Inserted:', result.insertedCount);
  } catch (bulkErr) {
    if (bulkErr.code === 11000 || bulkErr.name === 'MongoBulkWriteError') {
      const insertedCount = bulkErr.result?.nInserted || 0;
      const duplicateCount = validRecords.length - insertedCount;
      console.log('Caught MongoBulkWriteError. Inserted:', insertedCount, 'Dupes:', duplicateCount);
    } else {
      console.log('Unknown error:', bulkErr);
    }
  }

  mongoose.disconnect();
}

run().catch(console.error);
