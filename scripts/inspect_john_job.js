const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5001/api';
const client = axios.create({ baseURL: API, timeout: 10000 });

async function login(email, password) {
  const res = await client.post('/auth/login', { email, password });
  return res.data.token;
}

async function main() {
  try {
    const token = await login('john.doe@student.edu', 'password123');
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // Get profile
    const me = await client.get('/auth/me', auth);
    console.log('John Doe profile snapshot:');
    console.log({ id: me.data._id, name: `${me.data.firstName} ${me.data.lastName}`, profileStatus: me.data.studentProfile?.profileStatus, english: me.data.studentProfile?.englishProficiency, softSkills: me.data.studentProfile?.softSkillsArray || me.data.studentProfile?.softSkills });

    // Find the job by title
    const jobsRes = await client.get('/jobs', { params: { search: 'Data Intern' } });
    const job = jobsRes.data.jobs?.find(j => j.title && j.title.toLowerCase().includes('data intern')) || (jobsRes.data.jobs && jobsRes.data.jobs[0]);
    if (!job) {
      console.error('Data Intern job not found in /jobs');
      process.exit(1);
    }

    console.log('Found job:', { id: job._id, title: job.title, company: job.company?.name });

    // Get match details
    const matchRes = await client.get(`/jobs/${job._id}/match`, auth);
    const details = matchRes.data.matchDetails || matchRes.data;

    console.log('Match overall:', details.overallPercentage, 'canApply:', details.canApply);
    console.log('Breakdown:');
    console.log('Skills:', details.breakdown?.skills?.matched, '/', details.breakdown?.skills?.required, 'percentage:', details.breakdown?.skills?.percentage);
    console.log('Eligibility:', details.breakdown?.eligibility?.passed, '/', details.breakdown?.eligibility?.total, 'percentage:', details.breakdown?.eligibility?.percentage);
    console.log('Requirements:', details.breakdown?.requirements?.met, '/', details.breakdown?.requirements?.total, 'percentage:', details.breakdown?.requirements?.percentage);

    // Fetch readiness
    const readinessRes = await client.get('/job-readiness/my-status', auth).catch(() => null);
    console.log('Readiness status:', readinessRes?.data || 'none');

    // Check interest/application status
    const apps = await client.get('/applications', { params: { job: job._id }, headers: { Authorization: `Bearer ${token}` } });
    console.log('Applications for this job by John Doe:', apps.data.applications.length);

    process.exit(0);
  } catch (err) {
    console.error('Error running inspect script:', err.response?.data || err.message || err);
    process.exit(1);
  }
}

main();
