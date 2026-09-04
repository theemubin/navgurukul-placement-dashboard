const mongoose = require('mongoose');
require('dotenv').config();
const Job = require('../models/Job');
const User = require('../models/User');

async function seedJobs() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement');
  console.log('Connected successfully!');

  // Find a coordinator or manager to serve as the creator
  const creator = await User.findOne({ role: { $in: ['coordinator', 'manager', 'admin'] } }) || await User.findOne();
  if (!creator) {
    console.error('❌ Need at least one user in MongoDB to run the seed script.');
    process.exit(1);
  }
  const creatorId = creator._id;
  console.log(`Using User: ${creator.firstName} ${creator.lastName} (Role: ${creator.role}, ID: ${creatorId}) as creator.`);

  // Clear existing fake jobs first (identified by website)
  console.log('Clearing existing fake jobs...');
  const deleteResult = await Job.deleteMany({ 'company.website': 'https://fakecompany.com' });
  console.log(`Deleted ${deleteResult.deletedCount} existing fake jobs.`);

  console.log('Generating 100 fake jobs...');
  const fakeJobs = [];
  const titles = [
    'Frontend Developer', 'Backend Engineer', 'Fullstack Developer', 
    'Software Engineer', 'React Native Developer', 'QA Analyst', 
    'DevOps Associate', 'Data Analyst', 'UI/UX Designer', 
    'Technical Support Engineer'
  ];
  const locations = ['Remote', 'Bangalore', 'Pune', 'Delhi NCR', 'Mumbai', 'Hyderabad'];
  const jobTypes = ['full_time', 'internship', 'paid_project'];
  const techSkills = ['React', 'Node.js', 'MongoDB', 'Python', 'Java', 'Docker', 'AWS', 'Express.js', 'TypeScript'];

  for (let i = 1; i <= 100; i++) {
    const title = titles[i % titles.length] + ` (Batch ${Math.floor(i / 10) + 1})`;
    const location = locations[i % locations.length];
    const jobType = jobTypes[i % jobTypes.length];
    
    // Future deadline
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30 + (i % 15));

    fakeJobs.push({
      title: title,
      company: {
        name: `FakeCompany #${Math.floor((i - 1) / 5) + 1}`,
        logo: 'https://fakecompany.com/logo.png',
        website: 'https://fakecompany.com',
        description: `This is the description for FakeCompany #${Math.floor((i - 1) / 5) + 1}.`,
        pocName: `POC Person ${i}`,
        pocContact: '9999988888',
        pocEmail: `poc${i}@fakecompany.com`
      },
      description: `Detailed description for the fake job position of ${title}. Responsible for designing and maintaining next-generation placement dashboard features.`,
      requirements: [
        techSkills[i % techSkills.length],
        techSkills[(i + 1) % techSkills.length],
        'Good communication skills',
        'Strong problem-solving ability'
      ],
      responsibilities: [
        'Write clean, maintainable, and testable code.',
        'Collaborate with product and design teams to build user-friendly interfaces.',
        'Participate in code reviews and active pair programming.'
      ],
      location: location,
      roleCategory: 'Engineering',
      jobType: jobType,
      salary: {
        min: 15000 + (i * 500),
        max: 30000 + (i * 1000),
        currency: 'INR'
      },
      eligibility: {
        openForAll: true,
        readinessRequirement: 'no'
      },
      applicationDeadline: deadline,
      maxPositions: 1 + (i % 5),
      status: 'active',
      createdBy: creatorId
    });
  }

  console.log('Inserting 100 fake jobs into database...');
  const insertResult = await Job.insertMany(fakeJobs);
  console.log(`Successfully seeded ${insertResult.length} fake jobs!`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
  process.exit(0);
}

seedJobs().catch(err => {
  console.error('Error seeding fake jobs:', err);
  process.exit(1);
});
