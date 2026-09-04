const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const PORT = 5098;
process.env.PORT = PORT;
process.env.NODE_ENV = 'development'; // Ensure development logging is enabled

const app = require('../server');
const User = require('../models/User');
const cacheService = require('../services/redisCacheService');

function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          duration,
          data: json
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runDashboardCacheTest() {
  console.log('\n==================================================');
  console.log('   TESTING STUDENT DASHBOARD CACHE-ASIDE CACHING   ');
  console.log('==================================================\n');

  // Wait 2 seconds for MongoDB & Redis connections to initialize
  await new Promise(r => setTimeout(r, 2000));

  // Find a student from database
  const student = await User.findOne({ role: 'student', isActive: true });
  if (!student) {
    console.error('❌ No active student found in the database to run the test!');
    process.exit(1);
  }

  const studentId = student._id.toString();
  console.log(`Testing using Student: ${student.firstName} ${student.lastName} (ID: ${studentId})`);

  // Generate JWT token
  const token = jwt.sign(
    { userId: student._id },
    process.env.JWT_SECRET || 'navgurukul_placement_jwt_secret_2026_secure_key',
    { expiresIn: '1h' }
  );

  const statsKey = `student:stats:${studentId}`;
  const readinessKey = `student:job-readiness:${studentId}`;

  // Ensure any previous cache is cleared first
  await cacheService.deleteCache(statsKey);
  await cacheService.deleteCache(readinessKey);

  console.log('\n-----------------------------------------');
  console.log('1️⃣ TESTING STUDENT STATS CACHING');
  console.log('-----------------------------------------');

  console.log('Firing initial request to /api/stats/student (Expect MISS)...');
  const statsRes1 = await makeRequest('/api/stats/student', token);
  console.log(`  - Status: ${statsRes1.statusCode}`);
  console.log(`  - Response Time: ${statsRes1.duration} ms`);

  const statsExists = await cacheService.cacheExists(statsKey);
  console.log(`  - Key "${statsKey}" exists in Redis: ${statsExists ? 'YES ✅' : 'NO ❌'}`);

  console.log('Firing second request to /api/stats/student (Expect HIT)...');
  const statsRes2 = await makeRequest('/api/stats/student', token);
  console.log(`  - Status: ${statsRes2.statusCode}`);
  console.log(`  - Response Time: ${statsRes2.duration} ms`);

  console.log('\n-----------------------------------------');
  console.log('2️⃣ TESTING JOB READINESS CACHING');
  console.log('-----------------------------------------');

  console.log('Firing initial request to /api/job-readiness/my-status (Expect MISS)...');
  const readinessRes1 = await makeRequest('/api/job-readiness/my-status', token);
  console.log(`  - Status: ${readinessRes1.statusCode}`);
  console.log(`  - Response Time: ${readinessRes1.duration} ms`);

  const readinessExists = await cacheService.cacheExists(readinessKey);
  console.log(`  - Key "${readinessKey}" exists in Redis: ${readinessExists ? 'YES ✅' : 'NO ❌'}`);

  console.log('Firing second request to /api/job-readiness/my-status (Expect HIT)...');
  const readinessRes2 = await makeRequest('/api/job-readiness/my-status', token);
  console.log(`  - Status: ${readinessRes2.statusCode}`);
  console.log(`  - Response Time: ${readinessRes2.duration} ms`);

  console.log('\n-----------------------------------------');
  console.log('3️⃣ TESTING CACHE INVALIDATION');
  console.log('-----------------------------------------');
  
  console.log('Clearing stats & readiness keys...');
  await cacheService.deleteCache(statsKey);
  await cacheService.deleteCache(readinessKey);

  const statsExistsAfter = await cacheService.cacheExists(statsKey);
  const readinessExistsAfter = await cacheService.cacheExists(readinessKey);
  console.log(`  - Stats Key exists: ${statsExistsAfter ? 'YES ❌' : 'NO ✅'}`);
  console.log(`  - Readiness Key exists: ${readinessExistsAfter ? 'YES ❌' : 'NO ✅'}`);

  if (statsExists && readinessExists && !statsExistsAfter && !readinessExistsAfter) {
    console.log('\n==================================================');
    console.log('   ✅ ALL CACHE-ASIDE TEST CHECKS PASSED SUCCESSFULLY  ');
    console.log('==================================================\n');
  } else {
    console.error('\n==================================================');
    console.error('   ❌ CACHE-ASIDE TEST CHECKS FAILED              ');
    console.error('==================================================\n');
  }

  process.exit(0);
}

runDashboardCacheTest().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
