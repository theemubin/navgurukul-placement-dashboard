const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5001/api';
const client = axios.create({ baseURL: API, timeout: 5000 });

async function registerOrLogin({ email, password, firstName, lastName, role }) {
  try {
    const res = await client.post('/auth/register', { email, password, firstName, lastName, role });
    return { token: res.data.token, user: res.data.user };
  } catch (err) {
    if (err.response && err.response.data && (err.response.data.message || err.response.data.errors)) {
      if (err.response.data.message && err.response.data.message.includes('User already exists')) {
        const login = await client.post('/auth/login', { email, password });
        return { token: login.data.token, user: login.data.user };
      }
    }
    throw err;
  }
}

(async () => {
  try {
    console.log('Registering student...');
    const studentEmail = `approve_student_${Date.now()}@example.com`;
    const password = 'password1';
    const student = await registerOrLogin({ email: studentEmail, password, firstName: 'Approve', lastName: 'Student', role: 'student' });
    const studentClient = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${student.token}` } });

    console.log('Student updating profile (adding soft skill and course)...');
    await studentClient.put('/users/profile', {
      softSkills: { communication: 4 },
      courses: [{ courseName: 'Test Course', provider: 'TestProvider' }],
      about: 'Please approve my test profile'
    });

    // Submit for approval
    console.log('Submitting for approval...');
    await studentClient.post('/users/profile/submit');

    // Register POC and fetch pending profiles
    console.log('Registering POC...');
    const poc = await registerOrLogin({ email: `poc_${Date.now()}@example.com`, password, firstName: 'POC', lastName: 'User', role: 'campus_poc' });
    const pocClient = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${poc.token}` } });

    console.log('Fetching pending profiles...');
    const pending = await pocClient.get('/users/pending-profiles');
    const found = pending.data.data.find(s => s.email === studentEmail);
    if (!found) throw new Error('Submitted student not found in pending profiles');
    console.log('Found pending profile for', found.email);

    // Fetch student detail
    const studentDetail = await pocClient.get(`/users/students/${found._id}`);
    console.log('Student detail fetched, lastApprovedSnapshot exists?', !!studentDetail.data.studentProfile?.lastApprovedSnapshot);

    console.log('Approving profile...');
    await pocClient.put(`/users/students/${found._id}/profile/approve`, { status: 'approved' });

    const afterApprove = await pocClient.get(`/users/students/${found._id}`);
    console.log('After approve lastApprovedSnapshot exists?', !!afterApprove.data.studentProfile?.lastApprovedSnapshot);

    if (!afterApprove.data.studentProfile?.lastApprovedSnapshot) throw new Error('Snapshot not set on approval');

    console.log('Snapshot keys:', Object.keys(afterApprove.data.studentProfile.lastApprovedSnapshot));

    console.log('Smoke profile approval flow passed ✅');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    if (err.response) console.error('Response:', err.response.data);
    process.exit(1);
  }
})();