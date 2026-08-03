require('dotenv').config();
const mongoose = require('mongoose');
const Weather = require('./models/Weather');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const location = 'Colombo';
  const result = await Weather.deleteMany({
    location: { $regex: new RegExp(`^${location.trim()}$`, 'i') },
  });
  console.log('Delete result for Colombo:', result);

  mongoose.disconnect();
}

run().catch(console.error);
