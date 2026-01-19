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
    console.log('Registering student for language/soft test...');
    const studentEmail = `lang_student_${Date.now()}@example.com`;
    const password = 'password1';
    const student = await registerOrLogin({ email: studentEmail, password, firstName: 'Lang', lastName: 'Student', role: 'student' });
    const studentClient = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${student.token}` } });

    // Set CEFR English to B2 and soft skill Problem Solving to 3
    console.log('Updating english proficiency and soft skills...');
    await studentClient.put('/users/profile', { englishProficiency: { speaking: 'B2', writing: 'B2' }, softSkills: { problemSolving: 3 } });

    // Create a job with required skills: English (Advanced) and Problem Solving (Advanced)
    console.log('Creating coordinator and job with requirements...');
    const coord = await registerOrLogin({ email: `coord_${Date.now()}@example.com`, password, firstName: 'C', lastName: 'Ord', role: 'coordinator' });
    const coordClient = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${coord.token}` } });

    // Create skill objects for English and Problem Solving
    // Create or find skill English
    let skillEng;
    try {
      skillEng = await coordClient.post('/skills', { name: 'English', category: 'language' });
    } catch (e) {
      // find existing
      const s = (await coordClient.get('/skills', { params: { search: 'English' } })).data.find(x => x.name === 'English');
      if (!s) throw e; skillEng = { data: { skill: s } };
    }

    let skillPS;
    try {
      skillPS = await coordClient.post('/skills', { name: 'Problem Solving', category: 'technical' });
    } catch (e) {
      const s = (await coordClient.get('/skills', { params: { search: 'Problem' } })).data.find(x => x.name === 'Problem Solving');
      if (!s) throw e; skillPS = { data: { skill: s } };
    }

    // Create job with those required skills at proficiency 3 (Advanced)
    const jobData = {
      title: 'Smoke Job - Language & Problem Solving',
      company: { name: 'SmokeCo' },
      description: 'Test job',
      location: 'Remote',
      applicationDeadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      requiredSkills: [
        { skill: skillEng.data.skill._id, proficiencyLevel: 3, required: true },
        { skill: skillPS.data.skill._id, proficiencyLevel: 3, required: true }
      ],
      maxPositions: 1,
      applicationDeadline: new Date(Date.now() + 7 * 24 * 3600 * 1000)
    };

    const jobRes = await coordClient.post('/jobs', jobData);
    const job = jobRes.data.job;

    // Make job visible to students - use a student-visible pipeline stage
    await coordClient.patch(`/jobs/${job._id}/status`, { status: 'application_stage' });

    // Fetch student's match details for this job directly
    const matchRes = await studentClient.get(`/jobs/${job._id}/match`);
    const details = matchRes.data.matchDetails || matchRes.data.matchDetails || matchRes.data;
    console.log('Job match response snippet:', { overall: details?.overallPercentage, skills: details?.breakdown?.skills?.details?.slice(0,5) });

    const problemDetail = details.breakdown?.skills?.details?.find(d => d.skillName && d.skillName.toLowerCase().includes('problem'));
    const englishDetail = details.breakdown?.skills?.details?.find(d => d.skillName && d.skillName.toLowerCase().includes('english'));

    if (!problemDetail) throw new Error('Problem Solving detail missing');
    if (!englishDetail) throw new Error('English detail missing');

    console.log('Problem Solving student level:', problemDetail.studentLevel);
    console.log('English student level:', englishDetail.studentLevel);

    if (problemDetail.studentLevel === 0) throw new Error('Problem Solving student level is 0 (none)');
    if (englishDetail.studentLevel === 0) throw new Error('English student level is 0 (none)');

    console.log('Smoke language & soft skills test passed ✅');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    if (err.response) console.error('Response data:', err.response.data);
    process.exit(1);
  }
})();