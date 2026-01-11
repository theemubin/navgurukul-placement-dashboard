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
    if (school === 'School of Programming') {
      // Custom criteria as per requirements
      const customCriteria = [
        {
          criteriaId: 'real_life_project',
          name: 'One Real Life Project',
          description: 'Project link (student)',
          category: 'technical',
          isActive: true,
          isMandatory: true,
          weight: 1
        },
        {
          criteriaId: 'ai_integrated_project',
          name: 'One AI Integrated Project',
          description: 'Project link (student)',
          category: 'technical',
          isActive: true,
          isMandatory: true,
          weight: 1
        },
        {
          criteriaId: 'ai_interviewer_score',
          name: '70% above on AI interviewer tool',
          description: 'PDF link (student)',
          category: 'skills',
          isActive: true,
          isMandatory: true,
          weight: 1
        },
        {
          criteriaId: 'linkedin_updated_reviewed',
          name: 'LinkedIn updated + reviewed',
          description: 'LinkedIn link (student) + PoC comment',
          category: 'profile',
          isActive: true,
          isMandatory: true,
          weight: 1
        },
        {
          criteriaId: 'resume_updated_reviewed',
          name: 'Resume updated + reviewed',
          description: 'Resume link (student) + PoC comment',
          category: 'profile',
          isActive: true,
          isMandatory: true,
          weight: 1
        },
        {
          criteriaId: 'portfolio_updated_reviewed',
          name: 'Portfolio updated + reviewed',
          description: 'Portfolio link (student) + PoC comment',
          category: 'profile',
          isActive: true,
          isMandatory: true,
          weight: 1
        },
        {
          criteriaId: 'mock_interviews_done',
          name: 'At least 2 mock interviews done',
          description: 'Type of job for mock (student) + two PoC comments',
          category: 'preparation',
          isActive: true,
          isMandatory: true,
          weight: 1
        },
        {
          criteriaId: 'communication_engagements',
          name: '5 Communication Engagements',
          description: 'Tick mark (student) + PoC comment',
          category: 'skills',
          isActive: true,
          isMandatory: true,
          weight: 1
        },
        {
          criteriaId: 'placement_drive_completed',
          name: 'Placement drive completed',
          description: 'Tick mark (student) + PoC comment',
          category: 'preparation',
          isActive: true,
          isMandatory: true,
          weight: 1
        }
      ];
      const criteria = customCriteria;
      const config = new JobReadinessConfig({
        school,
        campus: null,
        criteria,
        createdBy: manager._id
      });
      await config.save();
      console.log(`Seeded job readiness config for ${school}`);
    } else {
      // For other schools, do not seed criteria
      const config = new JobReadinessConfig({
        school,
        campus: null,
        criteria: [],
        createdBy: manager._id
      });
      await config.save();
      console.log(`Seeded empty job readiness config for ${school}`);
    }
  }

  await mongoose.disconnect();
  console.log('Seeding complete.');
}

seedJobReadinessConfig().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
