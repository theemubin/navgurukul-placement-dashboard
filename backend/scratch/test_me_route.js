const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Register all models
require('../models/Campus');
require('../models/Skill');
require('../models/PlacementCycle');
require('../models/Notification');
const User = require('../models/User');

async function testMeRoute() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/navgurukul-placement';
    await mongoose.connect(mongoUri);

    const user = await User.findOne({ email: 'john.doe@student.edu' })
      .select('-password')
      .populate('campus')
      .populate('managedCampuses', 'name code')
      .populate('studentProfile.skills.skill')
      .populate('studentProfile.skills.approvedBy', 'firstName lastName');

    const userObj = user.toObject ? user.toObject() : user;
    
    console.log('--- USER OBJECT FROM ME ROUTE ---');
    console.log('Email:', userObj.email);
    console.log('Role:', userObj.role);
    console.log('studentProfile exists?', !!userObj.studentProfile);
    console.log('studentProfile.resumes exists?', !!userObj.studentProfile?.resumes);
    console.log('studentProfile.resumes:', JSON.stringify(userObj.studentProfile?.resumes, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

testMeRoute();
