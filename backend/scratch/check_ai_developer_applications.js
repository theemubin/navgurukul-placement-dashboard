const mongoose = require('mongoose');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const job = await Job.findOne({ title: 'AI Developer' });
  if (!job) {
    console.log('AI Developer job not found!');
    mongoose.disconnect();
    return;
  }
  console.log(`Found job: "${job.title}" (${job._id}), status: ${job.status}`);

  const apps = await Application.find({ job: job._id })
    .populate('student', 'firstName lastName email campus')
    .populate({
      path: 'student',
      populate: { path: 'campus', select: 'name' }
    });

  console.log(`Total Application documents found for this job: ${apps.length}`);
  apps.forEach((app, idx) => {
    console.log(`[${idx + 1}] Student: ${app.student?.firstName} ${app.student?.lastName}`);
    console.log(`    Email: ${app.student?.email}`);
    console.log(`    Campus: ${app.student?.campus?.name}`);
    console.log(`    Status: "${app.status}"`);
    console.log(`    ApplicationType: "${app.applicationType}"`);
    console.log(`    CreatedAt: ${app.createdAt}`);
  });

  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
