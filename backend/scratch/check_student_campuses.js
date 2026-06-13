const mongoose = require('mongoose');
const Campus = require('../models/Campus');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const students = await User.find({ role: 'student' });
  const uniqueGharCampuses = new Set();
  
  for (const s of students) {
    if (!s.campus) {
      const gc = s.studentProfile?.externalData?.ghar?.campus?.value || s.resolvedProfile?.campus;
      if (gc) {
        uniqueGharCampuses.add(gc);
      }
    }
  }
  
  console.log('Unique unmapped ghar campus values:', Array.from(uniqueGharCampuses));
  
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
