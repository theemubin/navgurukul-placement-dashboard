const https = require('https');

function get(options) {
    return new Promise((resolve, reject) => {
        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    console.log('Got Status:', res.statusCode);
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Status: ' + res.statusCode + ', Invalid JSON: ' + data));
                }
            });
        }).on('error', reject);
    });
}

async function debugStudent() {
    const email = 'ankush25@navgurukul.org';
    const rawToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJnaGFyYWRtaW5AbmF2Z3VydWt1bC5vcmciLCJpYXQiOjE3NzA3NDc5MDAsImV4cCI6MTc3ODUyMzkwMH0.-6RHep-teYheZOdDmzvrW6jSSyZ-LisUo1XioQ0TEzIeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJnaGFyYWRtaW5AbmF2Z3VydWt1bC5vcmciLCJpYXQiOjE3NzA3NDc5MDAsImV4cCI6MTc3ODUyMzkwMH0.-6RHep-teYheZOdDmzvrW6jSSyZ-LisUo1XioQ0TEzI';

    // Clean token as per gharApiService.js
    const token = rawToken.includes('eyJhbGci')
        ? 'eyJhbGci' + rawToken.split('eyJhbGci').pop()
        : rawToken;

    console.log('Clean Token Used:', token.substring(0, 20) + '...');

    try {
        console.log('Fetching Dev for', email);
        const response = await get({
            hostname: 'ghar.navgurukul.org',
            // REMOVED /api prefix as per gharApiService.js
            path: `/gharZoho/students/By/NgEmail?isDev=true&Student_ng_email=${encodeURIComponent(email)}`,
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data && response.data.length > 0) {
            console.log('--- FOUND IN DEV ---');
            console.log(JSON.stringify(response.data[0], null, 2));
        } else {
            console.log('Not in Dev, checking Prod...');
            const responseProd = await get({
                hostname: 'ghar.navgurukul.org',
                path: `/gharZoho/students/By/NgEmail?isDev=false&Student_ng_email=${encodeURIComponent(email)}`,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (responseProd.data && responseProd.data.length > 0) {
                console.log('--- FOUND IN PROD ---');
                console.log(JSON.stringify(responseProd.data[0], null, 2));
            } else {
                console.log('Not found in either Dev or Prod.');
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugStudent();
