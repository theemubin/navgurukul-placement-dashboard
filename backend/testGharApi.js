const axios = require('axios');
require('dotenv').config({ path: '.env' });

async function getSampleData() {
    const baseURL = 'https://ghar.navgurukul.org';
    const token = process.env.NAVGURUKUL_API_TOKEN;

    // Handle the double token issue if present
    const cleanToken = token.split('eyJhbGci').find(t => t.length > 0) ? 'eyJhbGci' + token.split('eyJhbGci').pop() : token;

    const client = axios.create({
        baseURL,
        headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Accept': 'application/json'
        }
    });

    console.log('--- Testing Ghar Dashboard (Zoho) API Endpoints ---\n');

    // 1. Attendance Config (We know this works)
    try {
        const res = await client.get('/gharZoho/All_Attendance_Configurations?isDev=true');
        console.log('✅ [Attendance Config]: Success');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.log('❌ [Attendance Config]: Failed', e.message);
    }

    console.log('\n--- End of Sample Test ---');
}

getSampleData();
