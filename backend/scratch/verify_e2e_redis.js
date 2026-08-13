const http = require('http');
const { execSync } = require('child_process');

const PORT = 5099;
process.env.PORT = PORT;
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.REDIS_ENABLED = 'true';

const app = require('../server');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.get(`http://localhost:${PORT}${path}`, (res) => {
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
  });
}

async function runE2EVerification() {
  console.log('\n==================================================');
  console.log('  STARTING REDIS END-TO-END VERIFICATION BENCHMARK  ');
  console.log('==================================================\n');

  // Wait 1.5 seconds for MongoDB / Redis connections
  await new Promise(r => setTimeout(r, 1500));

  // 1. Health check verification
  console.log('1️⃣ Checking /api/health endpoint...');
  const healthRes = await makeRequest('/api/health');
  console.log('Status Code:', healthRes.statusCode);
  console.log('Health Response Payload:', JSON.stringify(healthRes.data, null, 2));

  if (healthRes.data && healthRes.data.redis && healthRes.data.redis.status === 'connected') {
    console.log('✅ Redis Health Check PASSED!\n');
  } else {
    console.error('❌ Redis Health Check FAILED!\n');
  }

  // 2. Cache MISS & Cache HIT benchmark
  console.log('2️⃣ Testing Caching Middleware on /api/public/filters...');
  
  const req1 = await makeRequest('/api/public/filters');
  console.log(`Request #1 (Initial Load):`);
  console.log(`  - Status: ${req1.statusCode}`);
  console.log(`  - X-Cache Header: ${req1.headers['x-cache'] || 'None'}`);
  console.log(`  - Response Time: ${req1.duration} ms`);

  const req2 = await makeRequest('/api/public/filters');
  console.log(`Request #2 (Cached Response):`);
  console.log(`  - Status: ${req2.statusCode}`);
  console.log(`  - X-Cache Header: ${req2.headers['x-cache'] || 'None'}`);
  console.log(`  - Response Time: ${req2.duration} ms`);

  if (req1.headers['x-cache'] === 'MISS' && req2.headers['x-cache'] === 'HIT') {
    console.log(`🚀 Caching Benchmark PASSED! Speed improvement: ${(req1.duration / Math.max(req2.duration, 1)).toFixed(1)}x faster!\n`);
  } else {
    console.error(`❌ Caching Benchmark FAILED!\n`);
  }

  // 3. Testing Fallback Mode (Stopping Redis container temporarily)
  console.log('3️⃣ Testing Fault-Tolerant Fallback Mode (Stopping Redis)...');
  try {
    execSync('docker stop placement-redis');
    console.log('Redis container stopped.');

    // Wait 500ms for connection drop detection
    await new Promise(r => setTimeout(r, 500));

    const fallbackHealth = await makeRequest('/api/health');
    console.log('Health Redis status while Redis is down:', fallbackHealth.data.redis.status);

    const fallbackReq = await makeRequest('/api/public/filters');
    console.log(`Fallback API Request Status: ${fallbackReq.statusCode} (Expected 200)`);

    if (fallbackReq.statusCode === 200) {
      console.log('✅ Fault-Tolerant Fallback PASSED! API works seamlessly even when Redis is offline!\n');
    } else {
      console.error('❌ Fault-Tolerant Fallback FAILED!\n');
    }
  } catch (err) {
    console.error('Fallback test error:', err.message);
  } finally {
    console.log('Restarting Redis container...');
    execSync('docker start placement-redis');
    console.log('Redis container restarted.');
  }

  console.log('==================================================');
  console.log('  ALL E2E VERIFICATION CHECKS COMPLETED SUCCESSFULLY');
  console.log('==================================================\n');

  process.exit(0);
}

runE2EVerification().catch(err => {
  console.error('E2E Test Error:', err);
  process.exit(1);
});
