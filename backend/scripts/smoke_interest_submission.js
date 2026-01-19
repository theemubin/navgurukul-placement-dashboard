const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5001/api';
const client = axios.create({ baseURL: API, timeout: 10000 });

async function login(email, password) {
  const res = await client.post('/auth/login', { email, password });
  return res.data.token;
}

async function main() {
  try {
    console.log('Smoke test: submit interest for Data Intern');
    const token = await login('john.doe@student.edu', 'password123');
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // Find the job
    const jobsRes = await client.get('/jobs', { params: { search: 'Data Intern' }, headers: auth.headers });
    const job = jobsRes.data.jobs?.find(j => j.title && j.title.toLowerCase().includes('data intern')) || (jobsRes.data.jobs && jobsRes.data.jobs[0]);
    if (!job) throw new Error('Data Intern job not found');

    // Submit interest (type = interest) - no customResponses required for interest
    const applyRes = await client.post('/applications', { jobId: job._id, coverLetter: '', customResponses: [], type: 'interest' }, auth);

    if (applyRes.status !== 201) throw new Error('Unexpected response code: ' + applyRes.status);
    console.log('Interest submission response status:', applyRes.status);
    console.log('Application type:', applyRes.data.application.applicationType);
    if (applyRes.data.application.applicationType !== 'interest' && applyRes.data.application.status !== 'interested') {
      throw new Error('Application not created as interest');
    }

    console.log('Smoke interest test passed ✅');
    process.exit(0);
  } catch (err) {
    console.error('Smoke interest test failed:', err.response?.data || err.message || err);
    process.exit(1);
  }
}

main();
