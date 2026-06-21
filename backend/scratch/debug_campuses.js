const mongoose = require('mongoose');
const Campus = require('../models/Campus');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const campuses = await Campus.find();
  console.log('Campuses:');
  campuses.forEach(c => {
    console.log(`ID: ${c._id}, Name: ${c.name}, Code: ${c.code}`);
  });

  const student = await User.findOne({ email: 'aashikasingh24@navgurukul.org' });
  console.log('\nStudent Aashika Singh:');
  console.log('campus field:', student.campus);
  console.log('resolvedProfile.campus:', student.resolvedProfile?.campus);

  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
