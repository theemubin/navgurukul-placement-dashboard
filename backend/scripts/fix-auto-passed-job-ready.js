/**
 * One-time migration: reset students who were auto-marked Job Ready
 * because no JobReadinessConfig existed (0 criteriaStatus entries).
 *
 * Run: node backend/scripts/fix-auto-passed-job-ready.js
 * Add --dry-run to preview without writing changes.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { StudentJobReadiness, JobReadinessConfig } = require('../models/JobReadiness');
// Register all models so Mongoose populate works correctly
require('../models/User');
require('../models/Campus');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard');
  console.log('Connected to MongoDB');
  if (DRY_RUN) console.log('DRY RUN — no changes will be written\n');

  // Find all records that are marked job-ready but have zero criteria entries
  const suspects = await StudentJobReadiness.find({
    isJobReady: true,
    $or: [
      { criteriaStatus: { $size: 0 } },
      { criteriaStatus: { $exists: false } }
    ]
  }).populate('student', 'firstName lastName email');

  console.log(`Found ${suspects.length} auto-passed record(s) with 0 criteria\n`);

  if (suspects.length === 0) {
    console.log('Nothing to fix. Exiting.');
    await mongoose.disconnect();
    return;
  }

  let fixed = 0;
  let skipped = 0;

  for (const record of suspects) {
    const name = record.student
      ? `${record.student.firstName} ${record.student.lastName} (${record.student.email})`
      : `[unknown student] id=${record.student}`;

    // Double-check: does a config exist for this school/campus?
    const configExists = await JobReadinessConfig.exists({
      school: { $in: [record.school, 'Common'] },
      $or: [{ campus: record.campus }, { campus: null }],
      isActive: true
    });

    if (configExists) {
      // Config exists — the record may be legitimately job-ready via a different path.
      // Recalculate instead of blindly resetting.
      console.log(`  SKIP (config exists, will recalc): ${name} | school=${record.school}`);
      if (!DRY_RUN) {
        await record.calculateReadiness();
        await record.save();
      }
      skipped++;
    } else {
      // No config at all — this was a pure auto-pass. Reset it.
      console.log(`  RESET: ${name} | school=${record.school}`);
      if (!DRY_RUN) {
        record.isJobReady = false;
        record.readinessStatus = 'Not Job Ready';
        record.readinessPercentage = 0;
        record.approvedAsJobReady = false;
        await record.save();
      }
      fixed++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Reset (no config):  ${fixed}`);
  console.log(`  Recalculated:       ${skipped}`);
  if (DRY_RUN) console.log('\n(Dry run — no data was modified)');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
