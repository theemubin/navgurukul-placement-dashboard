const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5001/api';
const client = axios.create({ baseURL: API, timeout: 5000 });

(async () => {
  try {
    const coordEmail = `job_eng_coord_${Date.now()}@example.com`;
    const password = 'password1';

    // register/login
    let coord;
    try {
      const r = await client.post('/auth/register', { email: coordEmail, password, firstName: 'Job', lastName: 'Coord', role: 'coordinator' });
      coord = r.data;
    } catch (e) {
      const r = await client.post('/auth/login', { email: coordEmail, password });
      coord = r.data;
    }

    const auth = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${coord.token}` } });

    // Ensure English skill exists
    const skills = await auth.get('/skills', { params: { search: 'English' } });
    let englishSkill = skills.data.find(s => s.name === 'English');
    if (!englishSkill) {
      const created = await auth.post('/skills', { name: 'English', category: 'language' });
      englishSkill = created.data.skill;
    }

    // Create job including English in requiredSkills and also CEFR eligibility
    const jobPayload = {
      title: 'Smoke - English filter job',
      company: { name: 'SmokeCo' },
      description: 'Desc',
      location: 'Remote',
      applicationDeadline: new Date(Date.now() + 7*24*3600*1000).toISOString(),
      requiredSkills: [{ skill: englishSkill._id, proficiencyLevel: 3, required: true }],
      eligibility: { englishSpeaking: 'B2', englishWriting: '' },
      maxPositions: 1
    };

    const res = await auth.post('/jobs', jobPayload);
    const job = res.data.job;
    console.log('Created job id:', job._id);

    // Fetch job and verify requiredSkills does not contain English
    const fetched = await auth.get(`/jobs/${job._id}`);
    const rs = fetched.data.requiredSkills || [];
    const hasEnglish = rs.some(r => (r.skill && (r.skill._id === englishSkill._id || r.skill._id === englishSkill._id)) || (r.skill && r.skill.name === 'English'));
    console.log('Has English skill in requiredSkills?', hasEnglish);
    if (hasEnglish) throw new Error('English skill was not filtered out');

    console.log('Smoke check passed - English filtered out when CEFR set ✅');
    process.exit(0);
  } catch (err) {
    console.error('Smoke failed:', err.message || err);
    if (err.response) console.error('Resp:', err.response.data);
    process.exit(1);
  }
})();