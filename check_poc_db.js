const mongoose = require('mongoose');
const User = require('./backend/models/User');
require('dotenv').config({ path: './backend/.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const pendingStudents = await User.find({ 'studentProfile.profileStatus': 'pending_approval' });
  console.log(`Found ${pendingStudents.length} pending students.`);
  pendingStudents.forEach(s => {
    console.log(`Student: ${s.firstName} ${s.lastName}, Email: ${s.email}, Campus: ${s.campus}, Status: ${s.studentProfile?.profileStatus}`);
  });

  const pocs = await User.find({ role: 'campus_poc' });
  console.log(`\nFound ${pocs.length} POCs.`);
  pocs.forEach(p => {
    console.log(`POC: ${p.firstName} ${p.lastName}, Email: ${p.email}, Campus: ${p.campus}, ManagedCampuses: ${p.managedCampuses}`);
  });
  
  mongoose.disconnect();
});
