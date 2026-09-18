/**
 * One-time migration to normalize jobs that were finalized inconsistently.
 *
 * Rules:
 * - If any student is selected, job status must be 'filled'.
 * - If no student is selected, job status must be 'closed'.
 * - Any non-final application under a finalized job is moved to 'rejected'.
 * - Every rejection gets a coordinator-facing comment in statusHistory/statusComment.
 *
 * Run:
 *   node backend/scripts/normalize-job-finalization.js
 *   node backend/scripts/normalize-job-finalization.js --dry-run
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Application = require('../models/Application');

const DRY_RUN = process.argv.includes('--dry-run');
const FINAL_APPLICATION_STATUSES = ['selected', 'withdrawn', 'rejected', 'closed'];

function buildRejectionNote(job, application, finalJobStatus) {
  const stage = application.status || 'unknown stage';
  return `Auto-rejected because ${job.title} was finalized as ${finalJobStatus}. Previous stage: ${stage}.`;
}

async function normalizeJob(job) {
  const applications = await Application.find({ job: job._id })
    .select('status statusComment statusHistory currentRound roundResults student job createdAt');

  const selectedApplications = applications.filter(app => app.status === 'selected');
  const activeApplications = applications.filter(app => !FINAL_APPLICATION_STATUSES.includes(app.status));

  const targetJobStatus = selectedApplications.length > 0 ? 'filled' : 'closed';
  const needsJobStatusFix = job.status !== targetJobStatus;
  const needsPlacementsFix = job.placementsCount !== selectedApplications.length;

  if (!needsJobStatusFix && !needsPlacementsFix && activeApplications.length === 0) {
    return { changed: false, selectedCount: selectedApplications.length, activeCount: 0 };
  }

  console.log(`\nJob: ${job.title} (${job._id})`);
  console.log(`  current status: ${job.status}`);
  console.log(`  selected apps:  ${selectedApplications.length}`);
  console.log(`  active apps:    ${activeApplications.length}`);
  console.log(`  target status:  ${targetJobStatus}`);

  if (!DRY_RUN) {
    if (needsJobStatusFix) {
      job.status = targetJobStatus;
      job.statusHistory = job.statusHistory || [];
      job.statusHistory.push({
        status: targetJobStatus,
        changedAt: new Date(),
        notes: `Auto-normalized from ${job.status} because selected applications existed: ${selectedApplications.length}`
      });
    }

    if (needsPlacementsFix) {
      job.placementsCount = selectedApplications.length;
    }

    if (needsJobStatusFix || needsPlacementsFix) {
      await job.save();
    }

    for (const application of activeApplications) {
      const note = buildRejectionNote(job, application, targetJobStatus);
      application.status = 'rejected';
      application.statusComment = note;
      application.statusHistory = application.statusHistory || [];
      application.statusHistory.push({
        status: 'rejected',
        changedAt: new Date(),
        comment: note
      });
      await application.save();
    }
  }

  return { changed: needsJobStatusFix || needsPlacementsFix || activeApplications.length > 0, selectedCount: selectedApplications.length, activeCount: activeApplications.length };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard');
  console.log('Connected to MongoDB');
  if (DRY_RUN) console.log('DRY RUN - no changes will be written');

  const jobs = await Job.find({ status: { $in: ['closed', 'filled'] } })
    .select('title status placementsCount statusHistory');

  console.log(`Found ${jobs.length} closed/filled job(s)`);

  let changedJobs = 0;
  let touchedApplications = 0;

  for (const job of jobs) {
    const before = await Application.countDocuments({
      job: job._id,
      status: { $nin: FINAL_APPLICATION_STATUSES }
    });

    const result = await normalizeJob(job);
    if (result.changed) changedJobs++;
    touchedApplications += before;
  }

  console.log(`\nSummary:`);
  console.log(`  jobs scanned:          ${jobs.length}`);
  console.log(`  jobs needing changes:  ${changedJobs}`);
  console.log(`  active applications:   ${touchedApplications}`);
  if (DRY_RUN) console.log('  dry run only - nothing was modified');

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error('Migration failed:', error);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('Failed to disconnect cleanly:', disconnectError);
    }
    process.exit(1);
  });
}

module.exports = { main, normalizeJob };