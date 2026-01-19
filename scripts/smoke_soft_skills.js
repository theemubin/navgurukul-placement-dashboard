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

(async () => {
  try {
    console.log('Registering test student...');
    const studentEmail = `soft_student_${Date.now()}@example.com`;
    const password = 'password1';
    const student = await registerOrLogin({ email: studentEmail, password, firstName: 'Soft', lastName: 'Student', role: 'student' });
    const studentClient = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${student.token}` } });

    console.log('Setting soft skills mapping on profile...');
    const soft = { communication: 4, teamwork: 3, timeManagement: 2 };
    const res = await studentClient.put('/users/profile', { softSkills: soft, about: 'Soft skills test' });
    console.log('Save response:', res.data.message);

    const me = await studentClient.get('/auth/me');
    console.log('Fetched softSkills mapping:', me.data.studentProfile.softSkills);
    console.log('Fetched softSkills array (if present):', me.data.studentProfile.softSkillsArray);

    // Validate
    const mapping = me.data.studentProfile.softSkills;
    if (!mapping || mapping.communication !== 4) throw new Error('softSkills mapping not persisted correctly');
    const arr = me.data.studentProfile.softSkillsArray;
    if (!arr || !Array.isArray(arr) || arr.length === 0) throw new Error('softSkills array not created in DB');

    // Now submit profile for approval and ensure soft skills still visible
    console.log('Submitting profile for approval...');
    const submit = await studentClient.post('/users/profile/submit');
    console.log('Submit response:', submit.data.message);

    const meAfter = await studentClient.get('/auth/me');
    console.log('After submit softSkills mapping:', meAfter.data.studentProfile.softSkills);
    console.log('After submit softSkills array:', meAfter.data.studentProfile.softSkillsArray);

    if (!meAfter.data.studentProfile.softSkills || meAfter.data.studentProfile.softSkills.communication !== 4) throw new Error('softSkills lost after submission');

    console.log('Smoke soft skills test passed ✅');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    if (err.response) console.error('Response data:', err.response.data);
    process.exit(1);
  }
})();