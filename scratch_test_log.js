require('dotenv').config();
const mongoose = require('mongoose');
const Weather = require('./models/Weather');
const UploadLog = require('./models/UploadLog');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const uploadLogId = new mongoose.Types.ObjectId();
  console.log('Generated ID:', uploadLogId);

  try {
    const log = await UploadLog.create({
      _id: uploadLogId,
      filename: 'dummy-file.json',
      originalName: 'dummy-file.json',
      uploadedBy: new mongoose.Types.ObjectId(), // Fake user ID
      recordCount: 5,
      insertedCount: 0,
      duplicateCount: 5,
      errorCount: 0,
      status: 'failed',
      location: 'Test City',
      validationErrors: [],
      fileSize: 1024,
    });
    console.log('Log created successfully:', log._id);
  } catch (err) {
    console.error('Failed to create log:', err);
  }

  mongoose.disconnect();
}

run().catch(console.error);
