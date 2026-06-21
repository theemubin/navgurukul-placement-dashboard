const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const users = await User.find({});
  for (const user of users) {
    user.password = 'password123';
    user.isActive = true;
    await user.save();
    console.log(`Password reset for ${user.email} (${user.role})`);
  }
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
