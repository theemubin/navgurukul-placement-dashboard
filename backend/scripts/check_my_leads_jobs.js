const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5001/api';
const client = axios.create({ baseURL: API, timeout: 10000 });

async function login(email, password) {
  const res = await client.post('/auth/login', { email, password });
  return res.data.token;
}

(async () => {
  try {
    const token = await login('coordinator@placement.edu', 'password123');
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    const res = await client.get('/jobs', { params: { myLeads: true, limit: 10 }, headers: auth.headers });
    console.log('Jobs count for my leads:', res.data.jobs.length);
    if (res.data.jobs.length > 0) {
      console.log('Sample job:', {
        title: res.data.jobs[0].title,
        totalApplications: res.data.jobs[0].totalApplications,
        in_progress: res.data.jobs[0].statusCounts?.in_progress
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err.response?.data || err.message || err);
    process.exit(1);
  }
})();
