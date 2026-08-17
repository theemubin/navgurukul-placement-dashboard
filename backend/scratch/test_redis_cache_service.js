const { initRedis } = require('../config/redis');
const cacheService = require('../services/redisCacheService');

async function testCacheService() {
  console.log('--- Testing Redis Cache Service ---');

  // Ensure Redis client is initialized
  const client = await initRedis();
  if (!client) {
    console.error('❌ Failed to connect to Redis!');
    process.exit(1);
  }

  const testKey = 'test:cache:service:user:999';
  const testData = { name: 'Verified Student', school: 'School of Software Engineering' };

  console.log('\n1. Testing setCache...');
  const setOk = await cacheService.setCache(testKey, testData, 10);
  if (setOk) {
    console.log('✅ setCache PASSED');
  } else {
    console.error('❌ setCache FAILED');
  }

  console.log('\n2. Testing cacheExists...');
  const exists = await cacheService.cacheExists(testKey);
  if (exists) {
    console.log('✅ cacheExists PASSED');
  } else {
    console.error('❌ cacheExists FAILED');
  }

  console.log('\n3. Testing getCache...');
  const retrieved = await cacheService.getCache(testKey);
  console.log('Retrieved:', retrieved);
  if (retrieved && retrieved.name === 'Verified Student') {
    console.log('✅ getCache PASSED');
  } else {
    console.error('❌ getCache FAILED');
  }

  console.log('\n4. Testing deleteCache...');
  const delOk = await cacheService.deleteCache(testKey);
  const existsAfterDel = await cacheService.cacheExists(testKey);
  if (delOk && !existsAfterDel) {
    console.log('✅ deleteCache PASSED');
  } else {
    console.error('❌ deleteCache FAILED');
  }

  console.log('\n5. Testing deleteCacheByPattern...');
  await cacheService.setCache('test:pattern:1', { val: 1 }, 10);
  await cacheService.setCache('test:pattern:2', { val: 2 }, 10);
  
  const deletedCount = await cacheService.deleteCacheByPattern('test:pattern:*');
  console.log(`Deleted ${deletedCount} keys.`);
  
  const p1 = await cacheService.getCache('test:pattern:1');
  const p2 = await cacheService.getCache('test:pattern:2');
  if (deletedCount === 2 && p1 === null && p2 === null) {
    console.log('✅ deleteCacheByPattern PASSED');
  } else {
    console.error('❌ deleteCacheByPattern FAILED');
  }

  console.log('\n--- All Cache Service Tests Completed ---');
  process.exit(0);
}

testCacheService();
