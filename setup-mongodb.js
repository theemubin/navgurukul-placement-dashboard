#!/usr/bin/env node
/**
 * MongoDB Setup Script for Windows
 * This script helps install MongoDB Community Edition
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

async function setupMongoDB() {
  console.log('🚀 MongoDB Setup Assistant for Windows\n');

  if (os.platform() !== 'win32') {
    console.log('❌ This script is designed for Windows only.');
    console.log('For other platforms, visit: https://www.mongodb.com/try/download/community\n');
    process.exit(1);
  }

  console.log('📋 Options:');
  console.log('1. Use MongoDB Atlas (Cloud - Recommended, no installation needed)');
  console.log('2. Install MongoDB Community (Local - requires ~200MB download)');
  console.log('3. Skip and use existing MongoDB\n');

  // For automation, default to option 1 (Atlas) since it requires no installation
  console.log('✅ Defaulting to Option 1: MongoDB Atlas\n');

  console.log('📚 MongoDB Atlas Setup Instructions:');
  console.log('─'.repeat(50));
  console.log('1. Go to: https://www.mongodb.com/cloud/atlas');
  console.log('2. Click "Sign Up Free"');
  console.log('3. Create account and verify email');
  console.log('4. Create a new project');
  console.log('5. Create a cluster (M0 tier is FREE forever)');
  console.log('6. Click "Connect" and choose "Drivers"');
  console.log('7. Copy the connection string');
  console.log('8. Replace USERNAME and PASSWORD in the URI');
  console.log('9. Update backend/.env:\n');

  console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/placement_dashboard?retryWrites=true&w=majority');

  console.log('\n─'.repeat(50));
  console.log('⏱️  Takes about 5-10 minutes');
  console.log('💡 Need help? See: LOCAL_SETUP_GUIDE.md\n');

  // Test if local MongoDB is already running
  try {
    await execAsync('tasklist | findstr "mongod.exe"');
    console.log('✅ MongoDB is already running locally on port 27017!');
    console.log('You can proceed with `npm start`\n');
  } catch (error) {
    console.log('⚠️  MongoDB not found locally.');
    console.log('You have two options:');
    console.log('  a) Set up MongoDB Atlas (recommended) - see above');
    console.log('  b) Install MongoDB Community locally');
    console.log('\n💡 After setting up, restart the backend with nodemon\n');
  }
}

setupMongoDB().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
