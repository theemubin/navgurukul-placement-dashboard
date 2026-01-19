const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5001/api';
const client = axios.create({ baseURL: API, timeout: 10000 });

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
    const email = `interest_student_${Date.now()}@example.com`;
    const password = 'password1';
    const student = await registerOrLogin({ email, password, firstName: 'Interest', lastName: 'Student', role: 'student' });
    const auth = { headers: { Authorization: `Bearer ${student.token}` } };

    // Find job Data Intern
    const jobsRes = await client.get('/jobs', { params: { search: 'Data Intern' }, headers: auth.headers });
    const job = jobsRes.data.jobs?.find(j => j.title && j.title.toLowerCase().includes('data intern')) || (jobsRes.data.jobs && jobsRes.data.jobs[0]);
    if (!job) throw new Error('Data Intern job not found');

    // Submit interest
    const res = await client.post('/applications', { jobId: job._id, coverLetter: '', customResponses: [], type: 'interest' }, auth);
    console.log('Interest response status:', res.status);
    console.log('Application:', res.data.application._id, res.data.application.status);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message || err);
    process.exit(1);
  }
})();
