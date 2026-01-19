const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:5001/api';
const client = axios.create({ baseURL: API, timeout: 5000 });

async function registerOrLogin({ email, password, firstName, lastName, role }) {
  try {
    const res = await client.post('/auth/register', { email, password, firstName, lastName, role });
    return { token: res.data.token, user: res.data.user };
  } catch (err) {
    if (err.response && err.response.data && (err.response.data.message || err.response.data.errors)) {
      // If already exists, login
      if (err.response.data.message && err.response.data.message.includes('User already exists')) {
        const login = await client.post('/auth/login', { email, password });
        return { token: login.data.token, user: login.data.user };
      }
    }
    throw err;
  }
}

async function waitForHealth() {
  for (let i = 0; i < 10; i++) {
    try {
      const r = await client.get('/health');
      if (r.data && r.data.status === 'ok') return true;
    } catch (err) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('API not healthy after waiting');
}

(async () => {
  try {
    console.log('Checking API health...');
    await waitForHealth();
    console.log('API healthy');

    const studentEmail = `smoke_student_${Date.now()}@example.com`;
    const pocEmail = `smoke_poc_${Date.now()}@example.com`;
    const password = 'password1';

    console.log('Registering / logging in test users...');
    const student = await registerOrLogin({ email: studentEmail, password, firstName: 'Smoke', lastName: 'Student', role: 'student' });
    const poc = await registerOrLogin({ email: pocEmail, password, firstName: 'Smoke', lastName: 'POC', role: 'campus_poc' });

    console.log('Student token:', student.token.slice(0, 20) + '...');
    console.log('POC token:', poc.token.slice(0, 20) + '...');

    // Create a skill as POC
    const pocClient = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${poc.token}` } });
    let skills = await pocClient.get('/skills');
    let skillId;
    if (skills.data && skills.data.length > 0) {
      skillId = skills.data[0]._id;
      console.log('Using existing skill:', skills.data[0].name, skillId);
    } else {
      const newSkill = await pocClient.post('/skills', { name: 'Smoke Test Skill', category: 'technical' });
      skillId = newSkill.data.skill._id;
      console.log('Created skill:', newSkill.data.skill.name, skillId);
    }

    // Student adds skill with rating 3
    const studentClient = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${student.token}` } });
    console.log('Student adding skill with selfRating 3...');
    const addRes = await studentClient.post('/users/profile/skills', { skillId, selfRating: 3 });
    console.log('Add skill response:', addRes.data.message);

    // Fetch student profile and check pending skill
    const me = await studentClient.get('/auth/me');
    const pending = me.data.studentProfile.skills.find(s => s.skill && s.skill._id === skillId);
    if (!pending) throw new Error('Pending skill not found on student profile after add');
    if (pending.status !== 'pending') throw new Error('Pending skill status is not pending');
    if ((pending.selfRating || 0) < 1) throw new Error('Pending skill selfRating missing');
    console.log('Pending skill confirmed with rating', pending.selfRating);

    // POC approves the skill
    console.log('POC approving skill...');
    const approveRes = await pocClient.put(`/users/students/${me.data._id}/skills/${skillId}`, { status: 'approved' });
    console.log('Approve response:', approveRes.data.message);

    // Fetch student again and verify approved and technicalSkills updated
    const me2 = await studentClient.get('/auth/me');
    const approved = me2.data.studentProfile.skills.find(s => s.skill && s.skill._id === skillId);
    if (!approved) throw new Error('Skill not present after approval');
    if (approved.status !== 'approved') throw new Error('Skill status not updated to approved');

    const tech = (me2.data.studentProfile.technicalSkills || []).find(s => (s.skillId && s.skillId.toString()) === skillId.toString() || s.skillName === approved.skill.name);
    if (!tech) throw new Error('Technical skills not updated with approved skill');
    console.log('Approved skill present in technicalSkills with rating', tech.selfRating);

    // Student saves profile (to trigger merge logic)
    console.log('Student saving profile to test merge behavior...');
    const saveRes = await studentClient.put('/users/profile', { about: 'Smoke test save' });
    console.log('Save response:', saveRes.data.message);

    const me3 = await studentClient.get('/auth/me');
    const finalTech = (me3.data.studentProfile.technicalSkills || []).find(s => (s.skillId && s.skillId.toString()) === skillId.toString() || s.skillName === approved.skill.name);
    if (!finalTech) throw new Error('Approved skill disappeared after student save');

    console.log('Smoke test completed successfully ✅');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed:', err.message || err);
    if (err.response) console.error('Response:', err.response.status, err.response.data);
    process.exit(1);
  }
})();