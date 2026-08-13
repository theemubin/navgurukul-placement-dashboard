const { getClient, isRedisReady } = require('../config/redis');

/**
 * High-performance Cache Service wrapping Redis client with safe fallback logic.
 */
class CacheService {
  /**
   * Get value from Redis cache
   * @param {string} key 
   * @returns {Promise<any|null>}
   */
  async get(key) {
    if (!isRedisReady()) return null;
    try {
      const client = getClient();
      const data = await client.get(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.warn(`[CacheService] Error getting key "${key}":`, error.message);
      return null;
    }
  }

  /**
   * Set value in Redis cache with TTL in seconds
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlSeconds Default: 300 seconds (5 mins)
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttlSeconds = 300) {
    if (!isRedisReady()) return false;
    try {
      const client = getClient();
      const stringified = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await client.set(key, stringified, { EX: ttlSeconds });
      } else {
        await client.set(key, stringified);
      }
      return true;
    } catch (error) {
      console.warn(`[CacheService] Error setting key "${key}":`, error.message);
      return false;
    }
  }

  /**
   * Delete specific key from Redis cache
   * @param {string} key 
   * @returns {Promise<boolean>}
   */
  async del(key) {
    if (!isRedisReady()) return false;
    try {
      const client = getClient();
      await client.del(key);
      return true;
    } catch (error) {
      console.warn(`[CacheService] Error deleting key "${key}":`, error.message);
      return false;
    }
  }

  /**
   * Delete all keys matching pattern using SCAN (non-blocking)
   * @param {string} pattern Example: 'cache:jobs:*' or 'cache:stats:*'
   * @returns {Promise<number>} Number of keys deleted
   */
  async delPattern(pattern) {
    if (!isRedisReady()) return 0;
    try {
      const client = getClient();
      let cursor = '0';
      let deletedCount = 0;

      do {
        const reply = await client.scan(String(cursor), {
          MATCH: pattern,
          COUNT: 100
        });

        cursor = reply.cursor;
        const keys = reply.keys;

        if (keys && keys.length > 0) {
          await client.del(keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0' && cursor !== 0);

      if (deletedCount > 0) {
        console.log(`[CacheService] Invalidated ${deletedCount} cache key(s) matching pattern: "${pattern}"`);
      }
      return deletedCount;
    } catch (error) {
      console.warn(`[CacheService] Error deleting pattern "${pattern}":`, error.message);
      return 0;
    }
  }

  /**
   * Clear entire Redis database (use with care)
   */
  async flush() {
    if (!isRedisReady()) return false;
    try {
      const client = getClient();
      await client.flushDb();
      console.log('[CacheService] Flushed entire Redis database');
      return true;
    } catch (error) {
      console.warn('[CacheService] Error flushing Redis DB:', error.message);
      return false;
    }
  }
}

module.exports = new CacheService();
