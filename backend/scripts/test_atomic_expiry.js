const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const InterestRequest = require('../models/InterestRequest');
require('dotenv').config({ path: './.env' });

// Simulate the expiry logic from both implementations
async function expirePastDeadlineInterestRequests(filterJobId = null, simulateAppUpdateFailure = false) {
  try {
    const now = new Date();
    const query = { status: 'pending' };
    if (filterJobId) query.job = filterJobId;

    const pendingRequests = await InterestRequest.find(query).populate('job').populate('student');
    const results = [];

    for (const req of pendingRequests) {
      if (req.job && req.job.applicationDeadline && new Date(req.job.applicationDeadline) < now) {
        // Atomic update: only transition if still pending to prevent duplicate processing
        const updated = await InterestRequest.findOneAndUpdate(
          { _id: req._id, status: 'pending' },
          {
            status: 'rejected',
            rejectionReason: 'PoC has not approved before deadline',
            reviewNotes: 'Automatically rejected because Campus PoC did not approve before the application deadline.',
            reviewedAt: now
          },
          { new: true }
        );

        // Only proceed with side effects if this process performed the transition
        if (updated) {
          try {
            if (simulateAppUpdateFailure) {
              throw new Error('Simulated Application.updateMany failure');
            }
            await Application.updateMany(
              { student: req.student, job: req.job._id, applicationType: 'interest', status: { $in: ['applied', 'interested', 'pending'] } },
              {
                $set: {
                  status: 'rejected',
                  feedback: 'PoC has not approved before deadline',
                  statusComment: 'PoC has not approved before deadline'
                },
                $push: {
                  statusHistory: {
                    status: 'rejected',
                    changedAt: now,
                    comment: 'PoC has not approved before deadline'
                  }
                }
              }
            );
            results.push({ requestId: req._id, performedUpdate: true, appUpdateSuccess: true });
          } catch (appUpdateErr) {
            console.error(`Failed to update Application for rejected InterestRequest ${req._id}:`, appUpdateErr);
            console.error(`InterestRequest is 'rejected' but Application may still be 'interested'. Reconciliation will retry on next scheduler run.`);
            results.push({ requestId: req._id, performedUpdate: true, appUpdateSuccess: false, error: appUpdateErr.message });
            // Don't send Discord notification if Application update failed
            return results;
          }
        } else {
          results.push({ requestId: req._id, performedUpdate: false, reason: 'Already processed by another process' });
        }
      }
    }
    return results;
  } catch (err) {
    console.error('Error expiring past deadline interest requests:', err);
    throw err;
  }
}

// Reconciliation function to fix inconsistent states
async function reconcileRejectedInterestRequests() {
  try {
    const now = new Date();

    // Find rejected InterestRequests where the related Application is not rejected
    const inconsistentRequests = await InterestRequest.find({ status: 'rejected' }).populate('job');

    let fixedCount = 0;
    for (const req of inconsistentRequests) {
      // Skip if job was deleted
      if (!req.job) {
        continue;
      }

      const app = await Application.findOne({
        student: req.student,
        job: req.job._id,
        applicationType: 'interest',
        status: { $nin: ['rejected', 'withdrawn'] }
      });

      if (app) {
        try {
          await Application.updateOne(
            { _id: app._id },
            {
              $set: {
                status: 'rejected',
                feedback: 'PoC has not approved before deadline (reconciled)',
                statusComment: 'PoC has not approved before deadline (reconciled)'
              },
              $push: {
                statusHistory: {
                  status: 'rejected',
                  changedAt: now,
                  comment: 'PoC has not approved before deadline (reconciled)'
                }
              }
            }
          );
          fixedCount++;
          console.log(`Reconciled Application ${app._id} for rejected InterestRequest ${req._id}`);
        } catch (reconcileErr) {
          console.error(`Failed to reconcile Application ${app._id}:`, reconcileErr);
        }
      }
    }

    if (fixedCount > 0) {
      console.log(`Reconciliation: Fixed ${fixedCount} inconsistent Application records`);
    }
    return fixedCount;
  } catch (err) {
    console.error('Reconciliation error:', err);
    throw err;
  }
}

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.\n');

    // 1. Find or create a test job with past deadline
    let job = await Job.findOne({ title: /Test Atomic Expiry/i });
    if (!job) {
      const poc = await User.findOne({ role: 'campus_poc' });
      job = new Job({
        title: 'Test Atomic Expiry Job',
        company: { name: 'Test Company' },
        location: 'Remote',
        jobType: 'internship',
        description: 'Test job for atomic expiry verification',
        applicationDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        eligibility: {},
        status: 'active',
        coordinator: poc?._id,
        createdBy: poc?._id,
        roleCategory: 'Other'
      });
      await job.save();
      console.log(`Created test job: ${job.title} (ID: ${job._id})`);
    } else {
      // Update deadline to past
      job.applicationDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await job.save();
      console.log(`Using existing test job: ${job.title} (ID: ${job._id})`);
    }

    // 2. Find a student
    const student = await User.findOne({ role: 'student', email: /student/i });
    if (!student) {
      throw new Error('No test student found in DB');
    }
    console.log(`Using Student: ${student.firstName} ${student.lastName} (${student.email})`);

    // 3. Clean up any existing data
    await Application.deleteOne({ student: student._id, job: job._id });
    await InterestRequest.deleteOne({ student: student._id, job: job._id });
    console.log('Cleaned up existing applications/requests.\n');

    // ==================== TEST 1: Duplicate Expiry Prevention ====================
    console.log('=== TEST 1: Duplicate Expiry Prevention ===\n');

    // 4. Create a pending interest request
    console.log('Creating pending interest request...');
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
    console.log(`InterestRequest created with status 'pending' (ID: ${interestReq._id})\n`);

    // 5. Create an Application record with type 'interest'
    const interestApp = new Application({
      student: student._id,
      job: job._id,
      resume: student.studentProfile?.resume || 'http://example.com/resume.pdf',
      coverLetter: '',
      customResponses: [],
      applicationType: 'interest',
      status: 'interested'
    });
    await interestApp.save();
    console.log(`Application created with type 'interest' and status 'interested' (ID: ${interestApp._id})\n`);

    // 6. Simulate concurrent expiry attempts (scheduler and route helper)
    console.log('Simulating concurrent expiry attempts...\n');

    console.log('Attempt 1: Scheduler expiry (process 1)');
    const results1 = await expirePastDeadlineInterestRequests(job._id);
    console.log('Results:', JSON.stringify(results1, null, 2));
    console.log();

    console.log('Attempt 2: Route helper expiry (process 2) - should be idempotent');
    const results2 = await expirePastDeadlineInterestRequests(job._id);
    console.log('Results:', JSON.stringify(results2, null, 2));
    console.log();

    // 7. Verify only one process performed the update
    const totalUpdates = results1.filter(r => r.performedUpdate).length + results2.filter(r => r.performedUpdate).length;
    if (totalUpdates !== 1) {
      throw new Error(`Expected exactly 1 update, got ${totalUpdates}. Atomic check failed!`);
    }
    console.log('✅ TEST 1 PASSED: Only one process performed the update\n');

    // 8. Verify InterestRequest status
    const updatedReq = await InterestRequest.findById(interestReq._id);
    if (updatedReq.status !== 'rejected') {
      throw new Error(`InterestRequest status should be 'rejected', got '${updatedReq.status}'`);
    }
    console.log(`✅ InterestRequest status: '${updatedReq.status}'`);
    console.log(`   Rejection reason: ${updatedReq.rejectionReason}\n`);

    // 9. Verify Application status
    const updatedApp = await Application.findById(interestApp._id);
    if (updatedApp.status !== 'rejected') {
      throw new Error(`Application status should be 'rejected', got '${updatedApp.status}'`);
    }
    console.log(`✅ Application status: '${updatedApp.status}'`);
    console.log(`   Feedback: ${updatedApp.feedback}\n`);

    // 10. Verify status history has only one rejection entry
    if (!updatedApp.statusHistory || updatedApp.statusHistory.length !== 1) {
      throw new Error(`Application should have exactly 1 status history entry, got ${updatedApp.statusHistory?.length || 0}`);
    }
    console.log(`✅ Application status history entries: ${updatedApp.statusHistory.length}`);
    console.log(`   Latest: ${JSON.stringify(updatedApp.statusHistory[0])}\n`);

    // Clean up for next test
    await Application.deleteOne({ _id: interestApp._id });
    await InterestRequest.deleteOne({ _id: interestReq._id });
    console.log('Cleaned up test data for next test.\n');

    // ==================== TEST 2: Application Update Failure & Reconciliation ====================
    console.log('=== TEST 2: Application Update Failure & Reconciliation ===\n');

    // 11. Create a new pending interest request
    console.log('Creating new pending interest request...');
    const interestReq2 = new InterestRequest({
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
    await interestReq2.save();
    console.log(`InterestRequest created with status 'pending' (ID: ${interestReq2._id})\n`);

    // 12. Create an Application record
    const interestApp2 = new Application({
      student: student._id,
      job: job._id,
      resume: student.studentProfile?.resume || 'http://example.com/resume.pdf',
      coverLetter: '',
      customResponses: [],
      applicationType: 'interest',
      status: 'interested'
    });
    await interestApp2.save();
    console.log(`Application created with type 'interest' and status 'interested' (ID: ${interestApp2._id})\n`);

    // 13. Simulate Application update failure
    console.log('Simulating Application.updateMany failure...');
    const failResults = await expirePastDeadlineInterestRequests(job._id, true);
    console.log('Results:', JSON.stringify(failResults, null, 2));
    console.log();

    // 14. Verify InterestRequest is rejected but Application is still interested (inconsistent state)
    const failedReq = await InterestRequest.findById(interestReq2._id);
    const failedApp = await Application.findById(interestApp2._id);

    if (failedReq.status !== 'rejected') {
      throw new Error(`InterestRequest should be 'rejected' even after Application update failure, got '${failedReq.status}'`);
    }
    console.log(`✅ InterestRequest status: '${failedReq.status}' (atomic update succeeded)\n`);

    if (failedApp.status !== 'interested') {
      throw new Error(`Application should still be 'interested' after update failure, got '${failedApp.status}'`);
    }
    console.log(`✅ Application status: '${failedApp.status}' (update failed as expected)\n`);

    // 15. Run reconciliation to fix the inconsistent state
    console.log('Running reconciliation to fix inconsistent state...');
    const fixedCount = await reconcileRejectedInterestRequests();
    console.log(`Reconciliation fixed ${fixedCount} Application records\n`);

    // 16. Verify Application is now rejected
    const reconciledApp = await Application.findById(interestApp2._id);
    if (reconciledApp.status !== 'rejected') {
      throw new Error(`Application should be 'rejected' after reconciliation, got '${reconciledApp.status}'`);
    }
    console.log(`✅ Application status after reconciliation: '${reconciledApp.status}'`);
    console.log(`   Feedback: ${reconciledApp.feedback}\n`);

    // 17. Verify status history has exactly 1 entry (only from reconciliation, since initial update failed)
    if (!reconciledApp.statusHistory || reconciledApp.statusHistory.length !== 1) {
      throw new Error(`Application should have exactly 1 status history entry after reconciliation (initial update failed), got ${reconciledApp.statusHistory?.length || 0}`);
    }
    console.log(`✅ Application status history entries: ${reconciledApp.statusHistory.length}`);
    console.log(`   Latest (reconciled): ${JSON.stringify(reconciledApp.statusHistory[0])}\n`);

    console.log('✅ TEST 2 PASSED: Reconciliation fixed inconsistent state\n');

    // Clean up test data
    await Application.deleteOne({ _id: interestApp2._id });
    await InterestRequest.deleteOne({ _id: interestReq2._id });
    await Job.deleteOne({ _id: job._id });
    console.log('Cleaned up all test data.');
    console.log('\n=== All verification checks passed! 🎉 ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
