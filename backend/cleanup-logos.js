const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const Job = require('./models/Job');

async function cleanupLogos() {
  try {
    console.log('🔄 Connecting to MongoDB database...');
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard';
    await mongoose.connect(dbUri);
    console.log('🚀 Connected successfully.');

    console.log('🔍 Locating jobs with invalid company logo URLs...');
    
    // Find jobs where the company logo is the empty google favicon API query or empty domain
    const badLogoPattern = /domain=(&|$)/;
    const jobs = await Job.find({
      $or: [
        { 'company.logo': 'https://www.google.com/s2/favicons?domain=&sz=128' },
        { 'company.logo': badLogoPattern }
      ]
    });

    console.log(`📋 Found ${jobs.length} jobs with broken/empty logo URLs.`);

    if (jobs.length > 0) {
      console.log('🧹 Cleaning up logo URLs in database...');
      const result = await Job.updateMany(
        {
          $or: [
            { 'company.logo': 'https://www.google.com/s2/favicons?domain=&sz=128' },
            { 'company.logo': badLogoPattern }
          ]
        },
        { $set: { 'company.logo': '' } }
      );
      console.log(`✅ Database migration completed. Updated ${result.modifiedCount} jobs.`);
    } else {
      console.log('✨ Database is already clean. No broken logos found.');
    }

  } catch (error) {
    console.error('❌ Error executing database cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database.');
  }
}

cleanupLogos();
