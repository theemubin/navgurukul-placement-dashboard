const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '..//.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const student = await User.findOne({ email: 'aashikasingh24@navgurukul.org' }).populate('campus');
  console.log(JSON.stringify(student, null, 2));
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
