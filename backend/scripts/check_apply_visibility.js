const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5001/api';
const client = axios.create({ baseURL: API, timeout: 10000 });

async function login(email, password) {
  const res = await client.post('/auth/login', { email, password });
  return res.data.token;
}

(async () => {
  try {
    const token = await login('john.doe@student.edu', 'password123');
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    const jobsRes = await client.get('/jobs', { params: { search: 'Data Intern' }, headers: auth.headers });
    const job = jobsRes.data.jobs.find(j => j.title && j.title.toLowerCase().includes('data intern'));
    if (!job) throw new Error('Job not found');

    const matchRes = await client.get(`/jobs/${job._id}/match`, auth);
    const details = matchRes.data.matchDetails || matchRes.data;
    const readinessRes = await client.get('/job-readiness/my-status', auth).catch(() => null);
    const studentPct = readinessRes?.data?.readiness?.readinessPercentage || 0;
    const requirement = job.eligibility?.readinessRequirement || 'yes';

    let meetsReadiness = false;
    if (requirement === 'yes') {
      meetsReadiness = studentPct === 100;
    } else if (requirement === 'in_progress') {
      meetsReadiness = studentPct >= 30;
    } else {
      meetsReadiness = true;
    }

    const skillsOk = (details.breakdown?.skills?.percentage || 0) === 100;
    const eligibilityOk = (details.breakdown?.eligibility?.percentage || 0) === 100;
    const requirementsNotOk = (details.breakdown?.requirements?.percentage || 100) < 100;
    const allowApplyEvenIfMatchLow = skillsOk && eligibilityOk && requirementsNotOk;

    const canApplyUi = (details?.canApply === true) || (meetsReadiness && allowApplyEvenIfMatchLow);

    console.log({ overall: details.overallPercentage, canApply: details.canApply, studentPct, meetsReadiness, canApplyUi, allowApplyEvenIfMatchLow });
    process.exit(0);
  } catch (err) {
    console.error(err.response?.data || err.message || err);
    process.exit(1);
  }
})();