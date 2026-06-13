const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Sync data for Aashika Singh
  const email = 'aashikasingh24@navgurukul.org';
  const externalData = {
    Select_Campus: { Campus_Name: 'Eternal Campus' },
    Name: 'Aashika Singh'
  };

  console.log('Running User.syncGharData for Aashika Singh with campus "Eternal Campus"...');
  const updatedUser = await User.syncGharData(email, externalData);
  
  console.log('\nUpdated User Results:');
  console.log(`Email: ${updatedUser.email}`);
  console.log(`Campus ObjectId: ${updatedUser.campus}`);
  console.log(`Resolved Profile Campus: ${updatedUser.resolvedProfile?.campus}`);

  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
