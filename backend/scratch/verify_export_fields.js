const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');
const Job = require('../models/Job');
require('dotenv').config({ path: '../.env' });

// We can just simulate the handler or logic of the route in our script
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Test 1: Get export fields
  // Inside routes/applications.js we have the get /export/fields endpoint
  const fields = [
    { key: 'studentName', label: 'Student Name', category: 'Student Info' },
    { key: 'email', label: 'Email', category: 'Student Info' },
    { key: 'phone', label: 'Phone', category: 'Student Info' },
    { key: 'gender', label: 'Gender', category: 'Student Info' },
    { key: 'campus', label: 'Campus Name', category: 'Campus Info' },
    { key: 'hometown', label: 'Hometown Details', category: 'Student Info' },
  ];
  console.log('Export fields test:');
  const campusField = fields.find(f => f.key === 'campus');
  console.log(`  Found "campus" field option: ${!!campusField}`);
  console.log(`  Label: ${campusField?.label}, Category: ${campusField?.category}`);

  // Test 2: Check XLS generation
  // Simulating post /export/xls handler with a sample job query
  const job = await Job.findOne({ title: /Software/i });
  if (!job) {
    console.log('No job found to run XLS generation test.');
    mongoose.disconnect();
    return;
  }

  const applications = await Application.find({ job: job._id })
    .populate({
      path: 'student',
      populate: [
        { path: 'campus', select: 'name code' },
        { path: 'studentProfile.skills.skill', select: 'name' }
      ]
    })
    .populate('job', 'title company.name location jobType salary')
    .populate('feedbackBy', 'firstName lastName');

  // Let's import the same fieldMap structure
  const ratingToLevel = (rating) => {
    const num = parseInt(rating);
    if (num >= 4) return 'Expert';
    if (num >= 3) return 'Advanced';
    if (num >= 2) return 'Intermediate';
    if (num >= 1) return 'Basic';
    return '';
  };

  const fieldMap = {
    studentName: (app) => `${app.student?.firstName || ''} ${app.student?.lastName || ''}`.trim(),
    email: (app) => app.student?.email || '',
    phone: (app) => app.student?.phone || '',
    gender: (app) => app.student?.gender || '',
    campus: (app) => app.student?.campus?.name || '',
    jobTitle: (app) => app.job?.title || '',
    company: (app) => app.job?.company?.name || '',
  };

  const fixedPriority = [
    'studentName', 'campus', 'school', 'joiningDate',
    'resume', 'github', 'portfolio', 'linkedIn'
  ];

  const incomingFields = ['studentName', 'campus', 'email', 'jobTitle', 'company'];
  const prioritizedSelection = fixedPriority.filter(pk => incomingFields.includes(pk));
  const dynamicSelection = incomingFields.filter(ik => !fixedPriority.includes(ik));
  const selectedFields = [...prioritizedSelection, ...dynamicSelection];

  const headers = selectedFields.map(f => {
    return f.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  });

  console.log('\nGenerated Headers:');
  console.log(headers);

  const rows = applications.map(app =>
    selectedFields.map(field => {
      const value = fieldMap[field] ? fieldMap[field](app) : '';
      return String(value);
    })
  );

  console.log('\nGenerated Rows sample (up to 3):');
  rows.slice(0, 3).forEach((row, i) => {
    console.log(`  Row ${i+1}:`, row);
  });

  mongoose.disconnect();
}).catch(err => {
  console.error(err);
});
