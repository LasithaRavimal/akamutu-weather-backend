/**
 * utils/seedAdmin.js — Seeds the default admin user on first run.
 * Run with: node utils/seedAdmin.js
 */

const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding...');

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log(`ℹ️  Admin already exists: ${existingAdmin.email}`);
      process.exit(0);
    }

    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@akamutu.lk',
      password: process.env.ADMIN_PASSWORD || 'Admin@1234',
      role: 'admin',
    });

    console.log(`\n🎉 Admin user created successfully!`);
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@1234'}`);
    console.log(`   Role:     ${admin.role}\n`);
    console.log('⚠️  Please change the default password after first login.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seed();
