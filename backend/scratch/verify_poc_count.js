const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');
const Job = require('../models/Job');
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const jobId = '6a2bcfafe024a449b006a300';
  
  // Find a specific POC who manages Eternal BCA (69625e3875b42e946810acc9)
  const poc = await User.findOne({ email: 'meenakshi.dilip@navgurukul.org' });
  console.log(`POC: ${poc.firstName} ${poc.lastName}, Email: ${poc.email}`);
  console.log(`  Campus: ${poc.campus}, ManagedCampuses: ${poc.managedCampuses}`);

  // Build the query exactly as applications.js does for role = 'campus_poc'
  let query = { job: jobId };
  
  const campusIds = (poc.managedCampuses || []).map(id => id.toString());
  if (poc.campus) campusIds.push(poc.campus.toString());
  const uniqueCampusIds = [...new Set(campusIds)];
  
  console.log('Unique Campus IDs queried by this POC:', uniqueCampusIds);

  const campusStudents = await User.find({
    role: 'student',
    campus: { $in: uniqueCampusIds }
  }).select('_id');
  
  query.student = { $in: campusStudents.map(s => s._id) };
  
  const applications = await Application.find(query)
    .populate('student', 'firstName lastName email campus');
    
  console.log(`\nApplications visible to this POC for Node.js Backend Developer: ${applications.length}`);
  applications.forEach((app, idx) => {
    console.log(`  ${idx+1}. Student: ${app.student.firstName} ${app.student.lastName}, Campus: ${app.student.campus}`);
  });

  // Also query for a POC who manages all campuses (like Dharamshala POC)
  const dharamshalaPoc = await User.findOne({ email: 'poc.dharamshala@placement.edu' });
  let query2 = { job: jobId };
  const campusIds2 = (dharamshalaPoc.managedCampuses || []).map(id => id.toString());
  if (dharamshalaPoc.campus) campusIds2.push(dharamshalaPoc.campus.toString());
  const uniqueCampusIds2 = [...new Set(campusIds2)];
  
  const campusStudents2 = await User.find({
    role: 'student',
    campus: { $in: uniqueCampusIds2 }
  }).select('_id');
  query2.student = { $in: campusStudents2.map(s => s._id) };
  
  const applications2 = await Application.find(query2);
  console.log(`\nApplications visible to Dharamshala POC (manages all): ${applications2.length}`);

  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
