const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');
const Job = require('../models/Job');
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Find the Job
  const job = await Job.findOne({ title: /Node/i });
  console.log('Job:', job ? job.title : 'Not found', job ? job._id : '');
  
  if (!job) {
    mongoose.disconnect();
    return;
  }
  
  // Find all applications for this job
  const apps = await Application.find({ job: job._id })
    .populate('student', 'firstName lastName email campus role isActive');
  console.log(`\nFound ${apps.length} applications globally:`);
  apps.forEach((app, i) => {
    console.log(`${i+1}. Student: ${app.student?.firstName} ${app.student?.lastName}, Email: ${app.student?.email}, Campus: ${app.student?.campus}, Active: ${app.student?.isActive}, Role: ${app.student?.role}, App Status: ${app.status}`);
  });

  // Find POCs
  const pocs = await User.find({ role: 'campus_poc' });
  console.log(`\nFound ${pocs.length} POCs:`);
  pocs.forEach(p => {
    console.log(`POC: ${p.firstName} ${p.lastName}, Email: ${p.email}, Campus: ${p.campus}, ManagedCampuses: ${p.managedCampuses}`);
  });
  
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
