require('dotenv').config();
const mongoose = require('mongoose');
const { JobReadinessConfig, DEFAULT_CRITERIA } = require('./models/JobReadiness');
const User = require('./models/User');
const Campus = require('./models/Campus');

async function seedJobReadinessConfig() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard');
  console.log('Connected to MongoDB');

  // List of schools as per schema
  const schools = [
    'School of Programming',
    'School of Business',
    'School of Finance',
    'School of Education',
    'School of Second Chance'
  ];

  // Find a manager user to set as createdBy (fallback to first user if not found)
  let manager = await User.findOne({ role: 'manager' });
  if (!manager) manager = await User.findOne();
  if (!manager) throw new Error('No user found to assign as createdBy');

  for (const school of schools) {
    // Check if config already exists
    const exists = await JobReadinessConfig.findOne({ school, campus: null });
    if (exists) {
      console.log(`Config already exists for ${school}`);
      continue;
    }
    // Map DEFAULT_CRITERIA to config format
    const criteria = DEFAULT_CRITERIA.map(c => ({
      criteriaId: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      isActive: true,
      isMandatory: true,
      weight: 1
    }));
    const config = new JobReadinessConfig({
      school,
      campus: null,
      criteria,
      createdBy: manager._id
    });
    await config.save();
    console.log(`Seeded job readiness config for ${school}`);
  }

  await mongoose.disconnect();
  console.log('Seeding complete.');
}

seedJobReadinessConfig().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
