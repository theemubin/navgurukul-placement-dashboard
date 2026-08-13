const { initRedis, getRedisStats } = require('../config/redis');
const cacheService = require('../services/cacheService');

async function testRedisIntegration() {
  console.log('--- Testing Redis Client & Cache Service ---');
  
  const client = await initRedis();
  if (!client) {
    console.error('Failed to connect to Redis!');
    process.exit(1);
  }

  const statsBefore = await getRedisStats();
  console.log('Redis Stats:', statsBefore);

  console.log('\nSetting test key "test:user:101"...');
  await cacheService.set('test:user:101', { name: 'Test Student', role: 'student' }, 60);

  console.log('Getting test key "test:user:101"...');
  const cachedVal = await cacheService.get('test:user:101');
  console.log('Cached Value retrieved:', cachedVal);

  if (cachedVal && cachedVal.name === 'Test Student') {
    console.log('✅ Key GET/SET test PASSED!');
  } else {
    console.error('❌ Key GET/SET test FAILED!');
  }

  console.log('\nTesting delPattern("test:*")...');
  const deletedCount = await cacheService.delPattern('test:*');
  console.log(`Deleted ${deletedCount} key(s) matching pattern "test:*"`);

  const afterDel = await cacheService.get('test:user:101');
  if (afterDel === null) {
    console.log('✅ Pattern deletion test PASSED!');
  } else {
    console.error('❌ Pattern deletion test FAILED!');
  }

  process.exit(0);
}

testRedisIntegration();
