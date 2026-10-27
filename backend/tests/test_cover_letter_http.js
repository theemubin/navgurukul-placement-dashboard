require('../utils/domPolyfill');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const assert = require('assert');
const User = require('../models/User');
const app = require('../server');

const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runHttpTests() {
  console.log('============================================');
  console.log(' Testing Cover Letter HTTP Endpoints        ');
  console.log('============================================');

  let server;
  let testStudent;

  try {
    // 1. Start test server
    server = app.listen(TEST_PORT);
    console.log(`Test server running on port ${TEST_PORT}`);

    // Wait 500ms for connection
    await new Promise(r => setTimeout(r, 500));

    // 2. Create test student
    const testEmail = `http_cl_test_${Date.now()}@navgurukul.org`;
    testStudent = new User({
      email: testEmail,
      password: 'Password123!',
      firstName: 'HTTP',
      lastName: 'Student',
      role: 'student',
      studentProfile: {
        currentSchool: 'School of Programming',
        resumes: [],
        coverLetters: []
      }
    });
    await testStudent.save();
    console.log('✅ Created test student:', testStudent._id);

    // 3. Generate Auth JWT
    const token = jwt.sign(
      { userId: testStudent._id, role: 'student' },
      process.env.JWT_SECRET || 'secret'
    );
    const authHeaders = {
      Authorization: `Bearer ${token}`
    };

    // 4. Test POST /api/users/profile/cover-letters with text pitch
    console.log('Testing POST /api/users/profile/cover-letters (pitch text)...');
    const resPitch = await axios.post(
      `${BASE_URL}/api/users/profile/cover-letters`,
      {
        title: 'Full Stack Pitch',
        text: 'Passionate MERN stack developer looking for frontend & backend roles.',
        isPrimary: true
      },
      { headers: authHeaders }
    );
    assert.strictEqual(resPitch.status, 200);
    assert.strictEqual(resPitch.data.success, true);
    assert.strictEqual(resPitch.data.coverLetters.length, 1);
    assert.strictEqual(resPitch.data.coverLetters[0].isPrimary, true);
    assert.strictEqual(resPitch.data.coverLetters[0].title, 'Full Stack Pitch');
    const firstClId = resPitch.data.coverLetters[0]._id;
    console.log('✅ POST text pitch passed. Created cover letter ID:', firstClId);

    // 5. Test POST /api/users/profile/cover-letters with a second pitch
    console.log('Testing POST a second pitch (non-primary)...');
    const resSecond = await axios.post(
      `${BASE_URL}/api/users/profile/cover-letters`,
      {
        title: 'Data Analyst Pitch',
        text: 'Experienced in Python, SQL, Tableau, and MongoDB aggregation.',
        isPrimary: false
      },
      { headers: authHeaders }
    );
    assert.strictEqual(resSecond.status, 200);
    assert.strictEqual(resSecond.data.coverLetters.length, 2);
    const secondClId = resSecond.data.coverLetters[1]._id;
    assert.strictEqual(resSecond.data.coverLetters[0].isPrimary, true);
    assert.strictEqual(resSecond.data.coverLetters[1].isPrimary, false);
    console.log('✅ POST second cover letter passed. ID:', secondClId);

    // 6. Test PUT /api/users/profile/cover-letters/:id/primary (toggle primary)
    console.log('Testing PUT set primary...');
    const resPrimary = await axios.put(
      `${BASE_URL}/api/users/profile/cover-letters/${secondClId}/primary`,
      {},
      { headers: authHeaders }
    );
    assert.strictEqual(resPrimary.status, 200);
    const updatedSecond = resPrimary.data.coverLetters.find(c => c._id === secondClId);
    const updatedFirst = resPrimary.data.coverLetters.find(c => c._id === firstClId);
    assert.strictEqual(updatedSecond.isPrimary, true);
    assert.strictEqual(updatedFirst.isPrimary, false);
    console.log('✅ PUT set primary passed.');

    // 7. Test GET /api/users/profile
    console.log('Testing GET profile verification...');
    const resProfile = await axios.get(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
    assert.strictEqual(resProfile.status, 200);
    assert.strictEqual(resProfile.data.studentProfile.coverLetters.length, 2);
    assert.strictEqual(resProfile.data.studentProfile.coverLetter, 'Experienced in Python, SQL, Tableau, and MongoDB aggregation.');
    console.log('✅ GET profile verification passed.');

    // 8. Test DELETE /api/users/profile/cover-letters/:id
    console.log('Testing DELETE cover letter...');
    const resDelete = await axios.delete(
      `${BASE_URL}/api/users/profile/cover-letters/${secondClId}`,
      { headers: authHeaders }
    );
    assert.strictEqual(resDelete.status, 200);
    assert.strictEqual(resDelete.data.coverLetters.length, 1);
    assert.strictEqual(resDelete.data.coverLetters[0]._id, firstClId);
    assert.strictEqual(resDelete.data.coverLetters[0].isPrimary, true);
    console.log('✅ DELETE cover letter passed (remaining cover letter auto-promoted to primary).');

    console.log('============================================');
    console.log(' ALL HTTP COVER LETTER ENDPOINT TESTS PASSED ');
    console.log('============================================');
  } catch (err) { console.error("ERROR INSIDE TEST:", err.response?.data || err.message || err); throw err; } finally {
    if (testStudent) {
      await User.findByIdAndDelete(testStudent._id);
      console.log('Cleaned up test student user.');
    }
    if (server) {
      await new Promise(r => server.close(r));
      console.log('Closed test server.');
    }
    await mongoose.disconnect();
    process.exit(0);
  }
}

runHttpTests().catch(err => {
  console.error('HTTP test failed:', err.response?.data || err.message || err);
  process.exit(1);
});
