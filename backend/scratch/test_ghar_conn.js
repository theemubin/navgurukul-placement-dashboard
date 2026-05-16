const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const token = process.env.NAVGURUKUL_API_TOKEN;
const baseURL = 'https://ghar.navgurukul.org';

async function testConnection() {
    console.log('Testing connection to Ghar API...');
    console.log('Base URL:', baseURL);
    console.log('Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'MISSING');

    const jwtMarker = 'eyJhbGci';
    let tokenToUse = token ? token.trim() : '';
    if (tokenToUse.includes(jwtMarker)) {
        tokenToUse = jwtMarker + tokenToUse.split(jwtMarker).pop();
    }

    const authHeader = tokenToUse.startsWith('Bearer ') ? tokenToUse : `Bearer ${tokenToUse}`;
    console.log('Auth Header (first 30 chars):', authHeader.substring(0, 30) + '...');

    try {
        const response = await axios.get(`${baseURL}/gharZoho/All_Attendance_Configurations`, {
            params: { isDev: true },
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        console.log('✅ Connection Successful!');
        console.log('Status:', response.status);
        console.log('Data sample:', JSON.stringify(response.data).substring(0, 200));
    } catch (error) {
        console.error('❌ Connection Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testConnection();
