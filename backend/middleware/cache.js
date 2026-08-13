const cacheService = require('../services/cacheService');

/**
 * Express middleware for automatic response caching with Redis
 * @param {Object} options 
 * @param {number} options.ttl Time to live in seconds (default 300 = 5 minutes)
 * @param {string} options.keyPrefix Custom prefix for cache key namespace
 * @param {Function} options.buildKey Optional custom function to construct key (req) => string
 */
const cacheMiddleware = (options = {}) => {
  let { ttl, keyPrefix = '', buildKey, type } = options;

  // Resolve type-specific TTL from environment variables or defaults
  if (type === 'dashboard') {
    ttl = process.env.REDIS_TTL_DASHBOARD_STATS ? parseInt(process.env.REDIS_TTL_DASHBOARD_STATS, 10) : (ttl || 60);
  } else if (type === 'student') {
    ttl = process.env.REDIS_TTL_STUDENT_LIST ? parseInt(process.env.REDIS_TTL_STUDENT_LIST, 10) : (ttl || 60);
  } else if (type === 'jobs') {
    ttl = process.env.REDIS_TTL_JOB_LIST ? parseInt(process.env.REDIS_TTL_JOB_LIST, 10) : (ttl || 120);
  } else if (type === 'applications') {
    ttl = process.env.REDIS_TTL_APPLICATION_COUNTS ? parseInt(process.env.REDIS_TTL_APPLICATION_COUNTS, 10) : (ttl || 60);
  } else if (type === 'campus') {
    ttl = process.env.REDIS_TTL_CAMPUS_LIST ? parseInt(process.env.REDIS_TTL_CAMPUS_LIST, 10) : (ttl || 1800);
  } else if (type === 'job_readiness') {
    ttl = process.env.REDIS_TTL_JOB_READINESS ? parseInt(process.env.REDIS_TTL_JOB_READINESS, 10) : (ttl || 300);
  } else if (type === 'static') {
    ttl = process.env.REDIS_TTL_STATIC_DATA ? parseInt(process.env.REDIS_TTL_STATIC_DATA, 10) : (ttl || 3600);
  } else if (type === 'search') {
    ttl = process.env.REDIS_TTL_SEARCH_RESULTS ? parseInt(process.env.REDIS_TTL_SEARCH_RESULTS, 10) : (ttl || 60);
  } else {
    ttl = ttl || 300;
  }

  // Use global REDIS_CACHE_TTL env variable if defined to override cache durations globally
  if (process.env.REDIS_CACHE_TTL) {
    const envTtl = parseInt(process.env.REDIS_CACHE_TTL, 10);
    if (!isNaN(envTtl)) {
      ttl = envTtl;
    }
  }

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Determine cache key
    let cacheKey;
    if (typeof buildKey === 'function') {
      cacheKey = buildKey(req);
    } else {
      const prefix = keyPrefix ? `cache:${keyPrefix}` : 'cache';
      const userScope = req.user ? `:user:${req.user._id || req.user.id}` : ':public';
      cacheKey = `${prefix}:${req.originalUrl || req.url}${userScope}`;
    }

    try {
      const cachedResponse = await cacheService.get(cacheKey);

      if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.json(cachedResponse);
      }

      // Cache miss - intercept res.json to capture and cache response payload
      res.setHeader('X-Cache', 'MISS');
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        // Restore original res.json behavior first
        res.json = originalJson;

        // Cache successful 2xx responses
        if (res.statusCode >= 200 && res.statusCode < 300 && body !== undefined && body !== null) {
          cacheService.set(cacheKey, body, ttl).catch(err => {
            console.warn(`[CacheMiddleware] Failed to cache key "${cacheKey}":`, err.message);
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      console.warn('[CacheMiddleware] Error handling cache, proceeding without cache:', error.message);
      next();
    }
  };
};

/**
 * Invalidate cache patterns
 * @param {string|string[]} patterns 
 */
const invalidateCache = async (patterns) => {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  for (const pattern of patternArray) {
    await cacheService.delPattern(pattern);
  }
};

module.exports = {
  cacheMiddleware,
  invalidateCache
};
