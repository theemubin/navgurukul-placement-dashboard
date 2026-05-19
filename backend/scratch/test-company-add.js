const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Settings = require('../models/Settings');

async function testCompanyAdd() {
  try {
    console.log('🔄 Connecting to MongoDB database...');
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard';
    await mongoose.connect(dbUri);
    console.log('🚀 Connected successfully.');

    const name = "Mock Test Corp " + Date.now();
    const website = "https://mocktestcorp.com";
    const description = "A premium testing corporation.";
    const pocName = "John Doe";
    const pocContact = "1234567890";
    const pocEmail = "johndoe@mocktestcorp.com";
    
    console.log(`📝 Registering company "${name}"...`);

    const settings = await Settings.getSettings();
    const current = settings.masterCompanies || new Map();
    const normalizedName = name.trim();

    let logoUrl = "";
    const domain = website.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
    logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    let existing = current.get(normalizedName);
    if (existing) {
      if (typeof existing.toObject === 'function') {
        existing = existing.toObject();
      } else if (existing._doc) {
        existing = { ...existing._doc };
      } else {
        existing = JSON.parse(JSON.stringify(existing));
      }
    } else {
      existing = { name: normalizedName, website: '', description: '', pocs: [] };
    }

    if (website) existing.website = website;
    if (description) existing.description = description;
    if (logoUrl) existing.logo = logoUrl;

    if (pocName) {
      if (!existing.pocs) existing.pocs = [];
      const pocIndex = existing.pocs.findIndex(p => p.name.toLowerCase() === pocName.toLowerCase());
      const newPoc = {
        name: pocName,
        contact: pocContact || '',
        email: pocEmail || '',
        isPrimary: existing.pocs.length === 0
      };

      if (pocIndex > -1) {
        existing.pocs[pocIndex] = { ...existing.pocs[pocIndex], ...newPoc };
      } else {
        existing.pocs.push(newPoc);
      }
    }

    current.set(normalizedName, {
      ...existing,
      addedBy: new mongoose.Types.ObjectId() // mock ID
    });

    settings.masterCompanies = current;
    settings.markModified('masterCompanies');
    await settings.save();

    console.log('✅ Company successfully registered and saved in Settings database without errors!');

    // Let's verify it can be retrieved and updated again without errors!
    console.log('🔄 Attempting an update to the registered company...');
    const updatedSettings = await Settings.getSettings();
    const currentUpdated = updatedSettings.masterCompanies;
    let existingUpdated = currentUpdated.get(normalizedName);
    
    if (existingUpdated) {
      if (typeof existingUpdated.toObject === 'function') {
        existingUpdated = existingUpdated.toObject();
      } else if (existingUpdated._doc) {
        existingUpdated = { ...existingUpdated._doc };
      } else {
        existingUpdated = JSON.parse(JSON.stringify(existingUpdated));
      }
    }

    existingUpdated.description = "Updated premium testing corporation description.";
    currentUpdated.set(normalizedName, {
      ...existingUpdated,
      addedBy: new mongoose.Types.ObjectId()
    });

    updatedSettings.masterCompanies = currentUpdated;
    updatedSettings.markModified('masterCompanies');
    await updatedSettings.save();

    console.log('🎉 Update test passed successfully! No server errors.');

  } catch (error) {
    console.error('❌ Error testing company add:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database.');
  }
}

testCompanyAdd();
