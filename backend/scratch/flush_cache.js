const { getClient, isRedisReady, initRedis } = require('../config/redis');
const cacheService = require('../services/cacheService');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const flush = async () => {
  console.log('Initializing Redis connection...');
  await initRedis();
  
  setTimeout(async () => {
    if (isRedisReady()) {
      console.log('Redis is ready, deleting cache pattern cache:* ...');
      const count = await cacheService.delPattern('cache:*');
      console.log(`Successfully deleted ${count} keys.`);
      process.exit(0);
    } else {
      console.log('Redis connection was not ready.');
      process.exit(1);
    }
  }, 2000);
};

flush();
