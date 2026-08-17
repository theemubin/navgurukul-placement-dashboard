const { getClient, isRedisReady } = require('../config/redis');

/**
 * Reusable Redis Cache Service for Placement Dashboard
 * Provides helper functions for cache management with safe error fallbacks
 */
class RedisCacheService {
  constructor() {
    this.activeComputes = new Map();
  }

  /**
   * Safe check if logging should be active (only in development)
   */
  _shouldLog() {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Get value from Redis cache
   * @param {string} key 
   * @returns {Promise<any|null>}
   */
  async getCache(key) {
    if (!isRedisReady()) return null;
    try {
      const client = getClient();
      const data = await client.get(key);
      
      if (!data) {
        if (this._shouldLog()) {
          console.log(`[Cache] MISS - Key: ${key}`);
        }
        return null;
      }
      
      if (this._shouldLog()) {
        console.log(`[Cache] HIT - Key: ${key}`);
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.warn(`[CacheService] Error reading key "${key}":`, error.message);
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
  async setCache(key, value, ttlSeconds = 300) {
    if (!isRedisReady()) return false;
    try {
      const client = getClient();
      const stringified = JSON.stringify(value);
      
      if (ttlSeconds > 0) {
        await client.set(key, stringified, { EX: ttlSeconds });
      } else {
        await client.set(key, stringified);
      }
      
      if (this._shouldLog()) {
        console.log(`[Cache] SET - Key: ${key} (TTL: ${ttlSeconds}s)`);
      }
      return true;
    } catch (error) {
      console.warn(`[CacheService] Error writing key "${key}":`, error.message);
      return false;
    }
  }

  /**
   * Delete specific key from Redis cache
   * @param {string} key 
   * @returns {Promise<boolean>}
   */
  async deleteCache(key) {
    if (!isRedisReady()) return false;
    try {
      const client = getClient();
      await client.del(key);
      if (this._shouldLog()) {
        console.log(`[Cache] DELETE - Key: ${key}`);
      }
      return true;
    } catch (error) {
      console.warn(`[CacheService] Error deleting key "${key}":`, error.message);
      return false;
    }
  }

  /**
   * Delete all keys matching pattern using SCAN (non-blocking)
   * @param {string} pattern Example: 'cache:jobs:*'
   * @returns {Promise<number>} Number of keys deleted
   */
  async deleteCacheByPattern(pattern) {
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

      if (deletedCount > 0 && this._shouldLog()) {
        console.log(`[Cache] PATTERN DELETE - Invalidated ${deletedCount} key(s) matching: "${pattern}"`);
      }
      return deletedCount;
    } catch (error) {
      console.warn(`[CacheService] Error deleting pattern "${pattern}":`, error.message);
      return 0;
    }
  }

  /**
   * Check if a cache key exists
   * @param {string} key 
   * @returns {Promise<boolean>}
   */
  async cacheExists(key) {
    if (!isRedisReady()) return false;
    try {
      const client = getClient();
      const count = await client.exists(key);
      const exists = count > 0;
      if (this._shouldLog()) {
        console.log(`[Cache] EXISTS Check - Key: ${key} (Result: ${exists})`);
      }
      return exists;
    } catch (error) {
      console.warn(`[CacheService] Error checking existence of key "${key}":`, error.message);
      return false;
    }
  }

  /**
   * Invalidate cache on profile update
   * @param {string} studentId 
   */
  async invalidateProfileCache(studentId) {
    try {
      await this.deleteCache(`student:profile:${studentId}`);
      await this.deleteCache(`student:dashboard:${studentId}`);
    } catch (error) {
      console.warn(`[CacheService] Failed to invalidate profile cache for student "${studentId}":`, error.message);
    }
  }

  /**
   * Invalidate cache on application created/updated
   * @param {string} studentId 
   */
  async invalidateApplicationCache(studentId) {
    try {
      await this.deleteCache(`student:applications:${studentId}`);
      await this.deleteCache(`student:stats:${studentId}`);
      await this.deleteCache(`student:dashboard:${studentId}`);
    } catch (error) {
      console.warn(`[CacheService] Failed to invalidate application cache for student "${studentId}":`, error.message);
    }
  }

  /**
   * Invalidate cache on job readiness update
   * @param {string} studentId 
   */
  async invalidateJobReadinessCache(studentId) {
    try {
      await this.deleteCache(`student:job-readiness:${studentId}`);
      await this.deleteCache(`student:dashboard:${studentId}`);
    } catch (error) {
      console.warn(`[CacheService] Failed to invalidate readiness cache for student "${studentId}":`, error.message);
    }
  }

  /**
   * Invalidate cache on student dashboard-related data update
   * @param {string} studentId 
   */
  async invalidateDashboardCache(studentId) {
    try {
      await this.deleteCache(`student:dashboard:${studentId}`);
    } catch (error) {
      console.warn(`[CacheService] Failed to invalidate dashboard cache for student "${studentId}":`, error.message);
    }
  }

  /**
   * Fetch from cache, or compute and store in cache. Coalesces concurrent calls for the same key.
   * @param {string} key Cache key
   * @param {Function} computeFn Async function that queries database / computes value
   * @param {number} ttlSeconds TTL in seconds
   * @returns {Promise<any>}
   */
  async getOrCompute(key, computeFn, ttlSeconds = 300) {
    const totalStart = Date.now();
    let cached = null;
    let redisGetTime = 0;

    try {
      const redisGetStart = Date.now();
      cached = await this.getCache(key);
      redisGetTime = Date.now() - redisGetStart;
    } catch (error) {
      console.warn(`[CacheService] Error reading cache in getOrCompute:`, error.message);
    }

    if (cached !== null) {
      const totalTime = Date.now() - totalStart;
      if (this._shouldLog()) {
        console.log(`[Student Dashboard]\ncache=HIT\nredis=${redisGetTime}ms\ntotal=${totalTime}ms`);
      }
      return cached;
    }

    // 2. Cache miss: check if there's an ongoing calculation for this key
    if (this.activeComputes.has(key)) {
      if (this._shouldLog()) {
        console.log(`[Redis] Coalescing concurrent request for key: ${key}`);
      }
      return this.activeComputes.get(key);
    }

    // 3. No ongoing calculation: start one
    const computePromise = (async () => {
      try {
        const mongoStart = Date.now();
        const result = await computeFn();
        const mongoTime = Date.now() - mongoStart;

        let redisSetTime = 0;
        if (result !== undefined && result !== null) {
          try {
            const redisSetStart = Date.now();
            await this.setCache(key, result, ttlSeconds);
            redisSetTime = Date.now() - redisSetStart;
          } catch (error) {
            console.warn(`[CacheService] Error writing cache in getOrCompute:`, error.message);
          }
        }

        const totalTime = Date.now() - totalStart;
        if (this._shouldLog()) {
          console.log(`[Student Dashboard]\ncache=MISS\nredis=${redisGetTime}ms\nmongodb=${mongoTime}ms\nredisSet=${redisSetTime}ms\ntotal=${totalTime}ms`);
        }
        return result;
      } finally {
        // Always clean up the map when done
        this.activeComputes.delete(key);
      }
    })();

    this.activeComputes.set(key, computePromise);
    return computePromise;
  }
}

module.exports = new RedisCacheService();
