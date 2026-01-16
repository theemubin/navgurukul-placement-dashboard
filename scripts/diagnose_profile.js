const API_URL = 'http://localhost:5001/api';
let token = '';

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

    // Return both ok status and data
    return { ok: res.ok, status: res.status, data };
}

async function run() {
    try {
        const timestamp = Date.now();
        const email = `diag${timestamp}@example.com`;
        console.log(`Registering user: ${email}`);

        // Register
        const regRes = await request(`${API_URL}/auth/register`, 'POST', {
            firstName: 'Diag',
            lastName: 'User',
            email: email,
            password: 'password123',
            role: 'student'
        });

        if (!regRes.ok) throw new Error(`Register failed: ${JSON.stringify(regRes.data)}`);
        token = regRes.data.token;

        // Test 1: Empty Campus (Should succeed - no update)
        console.log('\nTest 1: Update with empty campus string');
        const t1 = await request(`${API_URL}/users/profile`, 'PUT', { firstName: 'T1', campus: '' });
        console.log(`Status: ${t1.status} ${t1.ok ? 'OK' : 'FAIL'}`, t1.ok ? '' : JSON.stringify(t1.data));

        // Test 2: Invalid Campus ID (Should likely fail if cast error, or ignore if validation handled)
        console.log('\nTest 2: Update with invalid campus ID "invalid-id"');
        const t2 = await request(`${API_URL}/users/profile`, 'PUT', { firstName: 'T2', campus: 'invalid-id' });
        console.log(`Status: ${t2.status} ${t2.ok ? 'OK' : 'FAIL'}`, t2.ok ? '' : JSON.stringify(t2.data));

        // Test 3: Invalid Join Date
        console.log('\nTest 3: Update with invalid joiningDate');
        const t3 = await request(`${API_URL}/users/profile`, 'PUT', { firstName: 'T3', joiningDate: 'invalid-date' });
        console.log(`Status: ${t3.status} ${t3.ok ? 'OK' : 'FAIL'}`, t3.ok ? '' : JSON.stringify(t3.data));

        // Test 4: Bad Resume Link (Should 400)
        console.log('\nTest 4: Update with unreachable resumeLink');
        const t4 = await request(`${API_URL}/users/profile`, 'PUT', { firstName: 'T4', resumeLink: 'https://invalid-url-that-does-not-exist.com/resume.pdf' });
        console.log(`Status: ${t4.status} ${t4.ok ? 'OK' : 'FAIL'}`, t4.ok ? '' : JSON.stringify(t4.data));

    } catch (error) {
        console.error('Diagnosis error:', error.message);
    }
}

run();
