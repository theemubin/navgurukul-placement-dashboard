const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5001/api';
const client = axios.create({ baseURL: API, timeout: 10000 });

async function login(email, password) {
  const res = await client.post('/auth/login', { email, password });
  return res.data.token;
}

async function main() {
  try {
    console.log('Smoke test: job custom requirement -> apply visibility');
    const token = await login('john.doe@student.edu', 'password123');
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // Get job
    const jobsRes = await client.get('/jobs', { params: { search: 'Data Intern' }, headers: auth.headers });
    const job = jobsRes.data.jobs?.find(j => j.title && j.title.toLowerCase().includes('data intern')) || (jobsRes.data.jobs && jobsRes.data.jobs[0]);
    if (!job) throw new Error('Data Intern job not found');

    // Get match details
    const matchRes = await client.get(`/jobs/${job._id}/match`, auth);
    const details = matchRes.data.matchDetails || matchRes.data;

    console.log('Match overall:', details.overallPercentage, 'canApply:', details.canApply);
    const missingReqs = (details?.breakdown?.requirements?.details || []).filter(d => !d.meets).map(d => d.requirement).filter(Boolean);

    if (missingReqs.length === 0) {
      throw new Error('Expected missing custom requirements but found none');
    }

    // Get readiness
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

    // Apply UI logic (same as frontend): allow apply when skills & eligibility ok and only requirements unmet
    const skillsOk = (details.breakdown?.skills?.percentage || 0) === 100;
    const eligibilityOk = (details.breakdown?.eligibility?.percentage || 0) === 100;
    const requirementsNotOk = (details.breakdown?.requirements?.percentage || 100) < 100;
    const allowApplyEvenIfMatchLow = skillsOk && eligibilityOk && requirementsNotOk;

    const canApplyUi = meetsReadiness && (details.canApply === true || allowApplyEvenIfMatchLow);

    if (!canApplyUi) {
      throw new Error(`Expected apply to be allowed by UI logic but it's not (meetsReadiness=${meetsReadiness}, canApply=${details.canApply}, allowApplyEvenIfMatchLow=${allowApplyEvenIfMatchLow})`);
    }

    console.log('Missing custom requirements:', missingReqs);
    console.log('Can Apply (UI logic):', canApplyUi);
    console.log('Smoke test passed ✅');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed:', err.response?.data || err.message || err);
    process.exit(1);
  }
}

main();
