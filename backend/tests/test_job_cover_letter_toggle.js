require('../utils/domPolyfill');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const assert = require('assert');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const app = require('../server');

const TEST_PORT = 5098;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runJobCoverLetterToggleTests() {
  console.log('====================================================');
  console.log(' Testing Coordinator Job Cover Letter Toggle Flow   ');
  console.log('====================================================');

  let server;
  let coordinator;
  let student;
  let jobNoCl;
  let jobWithCl;

  try {
    server = app.listen(TEST_PORT);
    await new Promise(r => setTimeout(r, 500));

    // 1. Create Coordinator and Student
    const ts = Date.now();
    coordinator = new User({
      email: `coord_${ts}@navgurukul.org`,
      password: 'Password123!',
      firstName: 'Coord',
      lastName: 'Leader',
      role: 'coordinator'
    });
    await coordinator.save();

    student = new User({
      email: `student_${ts}@navgurukul.org`,
      password: 'Password123!',
      firstName: 'Student',
      lastName: 'Applicant',
      role: 'student',
      studentProfile: {
        currentSchool: 'School of Programming',
        resume: 'https://example.com/resume.pdf'
      }
    });
    await student.save();

    const coordToken = jwt.sign(
      { userId: coordinator._id, role: 'coordinator' },
      process.env.JWT_SECRET || 'secret'
    );
    const studentToken = jwt.sign(
      { userId: student._id, role: 'student' },
      process.env.JWT_SECRET || 'secret'
    );

    // 2. Coordinator creates Job 1 with requiresCoverLetter = false
    console.log('Step 1: Coordinator creates Job 1 (requiresCoverLetter = false)...');
    const resJob1 = await axios.post(
      `${BASE_URL}/api/jobs`,
      {
        title: 'Backend Engineer - Standard',
        company: { name: 'Acme Corp' },
        description: 'Building microservices in Node.js',
        location: 'Remote',
        roleCategory: 'Software Development',
        applicationDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'active',
        requiresCoverLetter: false
      },
      { headers: { Authorization: `Bearer ${coordToken}` } }
    );
    assert.strictEqual(resJob1.status, 201);
    jobNoCl = resJob1.data.job;
    assert.strictEqual(jobNoCl.requiresCoverLetter, false);
    console.log('✅ Job 1 created with requiresCoverLetter = false (ID:', jobNoCl._id, ')');

    // 3. Coordinator creates Job 2 with requiresCoverLetter = true
    console.log('Step 2: Coordinator creates Job 2 (requiresCoverLetter = true)...');
    const resJob2 = await axios.post(
      `${BASE_URL}/api/jobs`,
      {
        title: 'Lead Architect - Pitch Required',
        company: { name: 'Pinnacle Labs' },
        description: 'High-level system design and leadership',
        location: 'Bangalore',
        roleCategory: 'Software Development',
        applicationDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'active',
        requiresCoverLetter: true
      },
      { headers: { Authorization: `Bearer ${coordToken}` } }
    );
    assert.strictEqual(resJob2.status, 201);
    jobWithCl = resJob2.data.job;
    assert.strictEqual(jobWithCl.requiresCoverLetter, true);
    console.log('✅ Job 2 created with requiresCoverLetter = true (ID:', jobWithCl._id, ')');

    // 4. Student applies to Job 1 (without cover letter) -> should SUCCEED
    console.log('Step 3: Student applies to Job 1 without cover letter...');
    const resApp1 = await axios.post(
      `${BASE_URL}/api/applications`,
      {
        jobId: jobNoCl._id,
        coverLetter: '',
        type: 'regular'
      },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    assert.strictEqual(resApp1.status, 201);
    const app1 = await Application.findById(resApp1.data.application._id);
    assert.strictEqual(app1.coverLetter, '');
    console.log('✅ Application to Job 1 succeeded without cover letter as expected.');

    // 5. Student attempts to apply to Job 2 (without cover letter) -> should be REJECTED (400)
    console.log('Step 4: Student attempts to apply to Job 2 without cover letter...');
    let rejected = false;
    try {
      await axios.post(
        `${BASE_URL}/api/applications`,
        {
          jobId: jobWithCl._id,
          coverLetter: '',
          type: 'regular'
        },
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
      assert.strictEqual(err.response.data.message, 'A cover letter is required to apply for this job');
      rejected = true;
    }
    assert.strictEqual(rejected, true, 'Application without cover letter should have been rejected');
    console.log('✅ Application to Job 2 without cover letter was correctly rejected.');

    // 6. Student applies to Job 2 with cover letter -> should SUCCEED
    console.log('Step 5: Student applies to Job 2 with cover letter...');
    const resApp2 = await axios.post(
      `${BASE_URL}/api/applications`,
      {
        jobId: jobWithCl._id,
        coverLetter: 'I have 5 years experience scaling cloud services to 10M users.',
        type: 'regular'
      },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    assert.strictEqual(resApp2.status, 201);
    const app2 = await Application.findById(resApp2.data.application._id);
    assert.strictEqual(app2.coverLetter, 'I have 5 years experience scaling cloud services to 10M users.');
    console.log('✅ Application to Job 2 with cover letter succeeded and saved.');

    // 7. Coordinator updates Job 1 to toggle requiresCoverLetter = true
    console.log('Step 6: Coordinator updates Job 1 via PUT to requiresCoverLetter = true...');
    const resUpdate = await axios.put(
      `${BASE_URL}/api/jobs/${jobNoCl._id}`,
      { requiresCoverLetter: true },
      { headers: { Authorization: `Bearer ${coordToken}` } }
    );
    assert.strictEqual(resUpdate.status, 200);
    const updatedJob1 = await Job.findById(jobNoCl._id);
    assert.strictEqual(updatedJob1.requiresCoverLetter, true);
    console.log('✅ Job update via PUT /api/jobs/:id successfully toggled requiresCoverLetter.');

    console.log('====================================================');
    console.log(' ALL COORDINATOR TOGGLE & CONDITIONAL TESTS PASSED! ');
    console.log('====================================================');
  } catch (err) {
    console.error('Test error:', err.response?.data || err.message || err);
    throw err;
  } finally {
    if (coordinator) await User.findByIdAndDelete(coordinator._id);
    if (student) await User.findByIdAndDelete(student._id);
    if (jobNoCl) {
      await Job.findByIdAndDelete(jobNoCl._id);
      await Application.deleteMany({ job: jobNoCl._id });
    }
    if (jobWithCl) {
      await Job.findByIdAndDelete(jobWithCl._id);
      await Application.deleteMany({ job: jobWithCl._id });
    }
    if (server) await new Promise(r => server.close(r));
    await mongoose.disconnect();
    process.exit(0);
  }
}

runJobCoverLetterToggleTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
