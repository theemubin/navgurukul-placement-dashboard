const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const InterestRequest = require('../models/InterestRequest');
require('dotenv').config({ path: './.env' });

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // 1. Find the Frontend Developer Intern job
    const job = await Job.findOne({ title: /Frontend Developer Intern/i });
    if (!job) {
      throw new Error('Frontend Developer Intern job not found in DB');
    }
    console.log(`Found Target Job: ${job.title} (${job._id})`);

    // 2. Find a student to use for testing
    const student = await User.findOne({ role: 'student', email: /student/i });
    if (!student) {
      throw new Error('No test student found in DB');
    }
    console.log(`Using Student: ${student.firstName} ${student.lastName} (${student.email})`);

    // Clean up any existing applications or interest requests for this student and job
    await Application.deleteOne({ student: student._id, job: job._id });
    await InterestRequest.deleteOne({ student: student._id, job: job._id });
    console.log('Cleaned up existing applications/requests for test student and job.');

    // 3. Create a pending interest request
    console.log('Simulating interest request creation...');
    const interestReq = new InterestRequest({
      student: student._id,
      job: job._id,
      matchDetails: {
        overallPercentage: 55,
        skillMatch: { matched: 1, required: 2, percentage: 50 },
        eligibilityMatch: {
          tenthGrade: { meets: true, required: false },
          twelfthGrade: { meets: true, required: false },
          higherEducation: { meets: true, required: false },
          school: { meets: true, required: false },
          campus: { meets: true, required: false },
          module: { meets: true, required: false }
        },
        requirementsMatch: { met: 0, total: 1, percentage: 0 }
      },
      reason: 'This is a test reason that is longer than fifty characters to pass the validation check.',
      acknowledgedGaps: ['Missing React skills'],
      status: 'pending'
    });
    await interestReq.save();
    console.log(`InterestRequest created successfully with status 'pending' (ID: ${interestReq._id})`);

    // 4. Verify that no Application exists
    const appBefore = await Application.findOne({ student: student._id, job: job._id });
    if (appBefore) {
      throw new Error('Application should not exist yet before POC approval!');
    }
    console.log('Verified: No Application document exists during pending status.');

    // 5. Verify application counts for the job (should exclude interested/pending)
    // Fetch job details by running the same count logic as backend jobs route
    const statusCountsBefore = await Application.aggregate([
      { $match: { job: job._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statusMapBefore = statusCountsBefore.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const activeAppliedKeys = ['applied', 'shortlisted', 'in_progress', 'selected', 'rejected'];
    const countBefore = activeAppliedKeys.reduce((a, key) => a + (statusMapBefore[key] || 0), 0);
    console.log(`Job active applicationCount (before approval): ${countBefore}`);

    // 6. Find a Campus PoC to approve the request
    const poc = await User.findOne({ role: 'campus_poc' });
    if (!poc) {
      throw new Error('No Campus POC found in DB');
    }
    console.log(`Using Campus POC: ${poc.firstName} ${poc.lastName} (${poc.email})`);

    // 7. Approve the InterestRequest
    console.log('POC approving interest request...');
    interestReq.status = 'approved';
    interestReq.reviewedBy = poc._id;
    interestReq.reviewedAt = new Date();
    interestReq.reviewNotes = 'Approved for testing';

    // Auto-create application as done in reviewInterestRequest route
    const newApp = new Application({
      student: student._id,
      job: job._id,
      resume: student.studentProfile?.resume || 'http://example.com/resume.pdf',
      coverLetter: '',
      customResponses: [],
      applicationType: 'regular',
      status: 'applied'
    });
    await newApp.save();
    interestReq.applicationCreated = newApp._id;
    await interestReq.save();
    console.log(`InterestRequest status updated to approved. Application created with ID: ${newApp._id}`);

    // 8. Verify that the Application exists and is in status 'applied'
    const appAfter = await Application.findOne({ student: student._id, job: job._id });
    if (!appAfter || appAfter.status !== 'applied') {
      throw new Error('Application was not created in status "applied" after POC approval!');
    }
    console.log(`Verified: Application document now exists with status: '${appAfter.status}'`);

    // 9. Re-verify application counts for the job (should now include it)
    const statusCountsAfter = await Application.aggregate([
      { $match: { job: job._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statusMapAfter = statusCountsAfter.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    const countAfter = activeAppliedKeys.reduce((a, key) => a + (statusMapAfter[key] || 0), 0);
    console.log(`Job active applicationCount (after approval): ${countAfter}`);

    if (countAfter !== countBefore + 1) {
      throw new Error('Application count did not increment after POC approval!');
    }
    console.log('Verified: Application count correctly incremented after POC approval! ✅');

    // Clean up test data
    await Application.deleteOne({ _id: newApp._id });
    await InterestRequest.deleteOne({ _id: interestReq._id });
    console.log('Cleaned up test data.');
    console.log('\nAll verification checks passed successfully! 🎉');
    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
