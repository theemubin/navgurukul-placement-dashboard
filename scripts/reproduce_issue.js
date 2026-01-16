const API_URL = 'http://localhost:5001/api';
let token = '';
let userId = '';

async function request(url, method, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    };

    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(`${method} ${url} failed: ${res.status} ${JSON.stringify(data)}`);
    }
    return data;
}

async function run() {
    try {
        // 1. Register a new user to ensure clean state
        const timestamp = Date.now();
        const email = `testuser${timestamp}@example.com`;
        console.log(`Registering user: ${email}`);

        const regData = await request(`${API_URL}/auth/register`, 'POST', {
            firstName: 'Test',
            lastName: 'User',
            email: email,
            password: 'password123',
            role: 'student'
        });
        token = regData.token;
        userId = regData.user._id;
        console.log('Registration successful.');

        // 2. Update Profile (Draft)
        console.log('Updating profile (Draft)...');
        const update1 = await request(`${API_URL}/users/profile`, 'PUT', {
            firstName: 'TestUpdated',
            about: 'Draft update',
            currentSchool: 'School of Programming'
        });
        console.log('Update 1 successful. Status:', update1.user.studentProfile.profileStatus);

        // 3. Submit Profile
        console.log('Submitting profile...');
        await request(`${API_URL}/users/profile/submit`, 'POST');
        console.log('Profile submitted.');

        // 4. Update Profile (Pending Approval)
        console.log('Updating profile (Pending Approval)...');
        const update2 = await request(`${API_URL}/users/profile`, 'PUT', {
            about: 'Update while pending approval'
        });
        console.log('Update 2 successful. Status:', update2.user.studentProfile.profileStatus);

        if (update2.user.studentProfile.profileStatus === 'pending_approval') {
            console.log('SUCCESS: Profile updated and status remained pending_approval');
        } else {
            console.log('WARNING: Status changed to:', update2.user.studentProfile.profileStatus);
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
        process.exit(1);
    }
}

run();
