const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const student = await User.findOne({ role: 'student' }).populate('campus');
  if (!student) {
    const anyUser = await User.findOne({});
    console.log('Any User:', anyUser);
  } else {
    console.log('Student found:', student.email);
    console.log(JSON.stringify(student, null, 2));
  }
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
