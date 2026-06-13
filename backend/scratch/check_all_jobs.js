const mongoose = require('mongoose');
const Job = require('../models/Job');
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const jobs = await Job.find();
  console.log(`Found ${jobs.length} jobs in database:`);
  jobs.forEach((j, i) => {
    console.log(`${i+1}. Title: ${j.title}, Company: ${j.company?.name}`);
  });
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
