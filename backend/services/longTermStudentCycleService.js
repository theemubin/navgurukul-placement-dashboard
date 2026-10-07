const PlacementCycle = require('../models/PlacementCycle');
const User = require('../models/User');
const Settings = require('../models/Settings');

const NON_PLACEMENT_STATUSES = [
  'Placed',
  'placed',
  'Dropout',
  'DropOut',
  'dropout',
  'Long Leave',
  'Completed-Opted out for placement'
];

const getCurrentCycleName = (date) => date.toLocaleString('en-US', {
  month: 'long',
  year: 'numeric'
});

const assignLongTermStudentsToCurrentCycle = async ({
  now = new Date(),
  createdBy
} = {}) => {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  let cycle = await PlacementCycle.findOne({ month, year });
  if (!cycle) {
    if (!createdBy) {
      throw new Error('createdBy is required when the current placement cycle does not exist');
    }
    cycle = await PlacementCycle.create({
      name: getCurrentCycleName(now),
      month,
      year,
      status: 'active',
      isActive: true,
      createdBy
    });
  }

  const query = {
    role: 'student',
    isActive: true,
    $and: [
      { $or: [{ placementCycle: null }, { placementCycle: { $exists: false } }] },
      { $or: [{ 'studentProfile.dateOfPlacement': null }, { 'studentProfile.dateOfPlacement': { $exists: false } }] },
      { 'studentProfile.joiningDate': { $lte: cutoff } },
      { 'studentProfile.currentStatus': { $nin: NON_PLACEMENT_STATUSES } }
    ]
  };

  const students = await User.find(query).select('_id').lean();
  if (students.length === 0) {
    return { cycle, assignedCount: 0 };
  }

  const addedAt = new Date();
  const studentIds = students.map(student => student._id);
  await PlacementCycle.updateOne(
    { _id: cycle._id },
    {
      $push: {
        snapshotStudents: {
          $each: studentIds.map(student => ({
            student,
            addedAt,
            status: 'active'
          }))
        }
      },
      $max: { maxStudentsInCycle: (cycle.snapshotStudents || []).filter(s => s.status === 'active').length + studentIds.length }
    }
  );

  const result = await User.updateMany(
    { ...query, _id: { $in: studentIds } },
    {
      $set: {
        placementCycle: cycle._id,
        placementCycleAssignedAt: addedAt
      }
    }
  );

  return { cycle, assignedCount: result.modifiedCount };
};

const runLongTermStudentCycleAssignmentOncePerDay = async (createdBy) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let settings = await Settings.findOne().select('_id lastLongTermCycleAssignmentDate');
  if (!settings) settings = await Settings.create({});
  const claim = await Settings.updateOne(
    {
      _id: settings._id,
      $or: [
        { lastLongTermCycleAssignmentDate: { $exists: false } },
        { lastLongTermCycleAssignmentDate: { $lt: today } }
      ]
    },
    { $set: { lastLongTermCycleAssignmentDate: new Date() } }
  );

  if (claim.modifiedCount !== 1) {
    return { skipped: true, assignedCount: 0 };
  }

  const automationUser = createdBy
    ? await User.findById(createdBy).select('_id').lean()
    : process.env.PLACEMENT_CYCLE_AUTOMATION_USER_ID
    ? await User.findById(process.env.PLACEMENT_CYCLE_AUTOMATION_USER_ID).select('_id').lean()
    : await User.findOne({
      role: { $in: ['manager', 'coordinator', 'campus_poc'] },
      isActive: true
    }).sort({ role: 1 }).select('_id').lean();

  if (!automationUser) {
    throw new Error('Long-term student cycle automation skipped: no active automation user found');
  }

  const result = await assignLongTermStudentsToCurrentCycle({ createdBy: automationUser._id });
  console.log(`Long-term student cycle automation assigned ${result.assignedCount} student(s) to ${result.cycle.name}`);
  return { skipped: false, ...result };
};

const startLongTermStudentCycleScheduler = () => {
  runLongTermStudentCycleAssignmentOncePerDay().catch(error => {
    console.error('Long-term student cycle automation failed:', error);
  });
  return setInterval(() => {
    runLongTermStudentCycleAssignmentOncePerDay().catch(error => {
      console.error('Long-term student cycle automation failed:', error);
    });
  }, 24 * 60 * 60 * 1000);
};

module.exports = {
  assignLongTermStudentsToCurrentCycle,
  runLongTermStudentCycleAssignmentOncePerDay,
  startLongTermStudentCycleScheduler
};
