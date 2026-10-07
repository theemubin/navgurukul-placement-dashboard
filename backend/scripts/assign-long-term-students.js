const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const { assignLongTermStudentsToCurrentCycle } = require('../services/longTermStudentCycleService');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard');

  const automationUser = process.env.PLACEMENT_CYCLE_AUTOMATION_USER_ID
    ? await User.findById(process.env.PLACEMENT_CYCLE_AUTOMATION_USER_ID).select('_id').lean()
    : await User.findOne({
      role: { $in: ['manager', 'coordinator', 'campus_poc'] },
      isActive: true
    }).sort({ role: 1 }).select('_id').lean();

  if (!automationUser) {
    throw new Error('Set PLACEMENT_CYCLE_AUTOMATION_USER_ID or create an active manager user');
  }

  const result = await assignLongTermStudentsToCurrentCycle({ createdBy: automationUser._id });
  console.log(`Assigned ${result.assignedCount} long-term students to ${result.cycle.name}`);
};

run()
  .catch(error => {
    console.error('Long-term student cycle automation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
