const mongoose = require('mongoose');
const Job = require('./models/Job');

async function checkJobStatuses() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard');
    
    console.log('📊 Checking current job statuses...');
    
    // Get all jobs with their statuses
    const jobs = await Job.find({})
      .select('title company.name status applicationDeadline createdAt')
      .sort({ createdAt: -1 });
    
    if (jobs.length === 0) {
      console.log('📭 No jobs found in the database.');
      return;
    }
    
    console.log(`\n📋 Found ${jobs.length} jobs:\n`);
    
    // Group by status
    const statusGroups = {};
    jobs.forEach(job => {
      if (!statusGroups[job.status]) {
        statusGroups[job.status] = [];
      }
      statusGroups[job.status].push(job);
    });
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    Object.entries(statusGroups).forEach(([status, jobsInStatus]) => {
      const visibilityNote = getVisibilityNote(status);
      console.log(`🏷️  ${status.toUpperCase()} (${jobsInStatus.length} jobs) ${visibilityNote}:`);
      
      jobsInStatus.forEach((job, index) => {
        const deadlineStr = new Date(job.applicationDeadline) >= startOfToday 
          ? `Open until ${job.applicationDeadline.toDateString()}`
          : `Closed (${job.applicationDeadline.toDateString()})`;
        console.log(`   ${index + 1}. ${job.title} at ${job.company.name} - ${deadlineStr}`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking job statuses:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

function getVisibilityNote(status) {
  const visibleStatuses = ['active', 'application_stage', 'hr_shortlisting', 'interviewing', 'on_hold', 'closed', 'filled'];
  const invisibleStatuses = ['draft', 'pending_approval'];
  
  if (visibleStatuses.includes(status)) {
    return '👁️  Visible to Students';
  } else if (invisibleStatuses.includes(status)) {
    return '🚫 Hidden from Students';
  } else {
    return '❓ Unknown Visibility';
  }
}

// Run the check if this script is executed directly
if (require.main === module) {
  checkJobStatuses();
}

module.exports = { checkJobStatuses };