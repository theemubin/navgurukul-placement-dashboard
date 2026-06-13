const mongoose = require('mongoose');
const Campus = require('../models/Campus');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const students = await User.find({ role: 'student', campus: null });
  console.log(`Found ${students.length} students with null campus`);
  
  for (const s of students) {
    const gc = s.studentProfile?.externalData?.ghar?.campus?.value || s.resolvedProfile?.campus;
    if (gc) {
      const dbCampus = await Campus.findOne({ name: new RegExp(`^${gc}$`, 'i') });
      console.log(`Email: ${s.email}, GharCampus: "${gc}", DB match exists: ${!!dbCampus}`);
    }
  }
  
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
