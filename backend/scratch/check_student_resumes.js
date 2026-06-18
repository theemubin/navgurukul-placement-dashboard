const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

async function checkResumes() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/navgurukul-placement';
    await mongoose.connect(mongoUri);

    const students = await User.find();
    console.log(`Found ${students.length} users:`);
    for (const student of students) {
      console.log(`\nID: ${student._id}`);
      console.log(`Email: ${student.email}`);
      console.log(`Role: ${student.role}`);
      console.log(`Name: ${student.firstName} ${student.lastName}`);
      console.log(`Resume Link: ${student.studentProfile?.resumeLink}`);
      console.log(`Resume: ${student.studentProfile?.resume}`);
      console.log(`Resumes List:`, JSON.stringify(student.studentProfile?.resumes || [], null, 2));
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkResumes();
