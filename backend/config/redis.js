const { createClient } = require('redis');

let client = null;
let isReady = false;
let isConnected = false;

const initRedis = async () => {
  if (process.env.REDIS_ENABLED === 'false') {
    console.log('[Redis] Redis caching is explicitly disabled via REDIS_ENABLED=false');
    return null;
  }

  // Construct configuration options
  let clientOptions = {};

  if (process.env.REDIS_URL) {
    clientOptions.url = process.env.REDIS_URL;
  } else if (process.env.REDIS_HOST) {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = process.env.REDIS_PORT || 6379;
    const username = process.env.REDIS_USERNAME || '';
    const password = process.env.REDIS_PASSWORD || '';
    const protocol = process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis';
    const auth = password ? `${username ? `${username}:` : ''}${password}@` : '';
    clientOptions.url = `${protocol}://${auth}${host}:${port}`;
  } else {
    clientOptions.url = 'redis://127.0.0.1:6379';
  }

  const sanitizedDisplayUrl = clientOptions.url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

  try {
    clientOptions.socket = {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.warn('[Redis] Max reconnect retries reached. Operating in fallback mode.');
          return new Error('Max retries reached');
        }
        // Exponential backoff with a cap of 3 seconds
        return Math.min(retries * 200, 3000);
      },
      connectTimeout: 5000,
    };

    if (process.env.REDIS_TLS === 'true' && !clientOptions.url.startsWith('rediss://')) {
      clientOptions.socket.tls = true;
    }

    client = createClient(clientOptions);

    client.on('connect', () => {
      isConnected = true;
      console.log(`[Redis] Connecting to Redis at ${sanitizedDisplayUrl}...`);
    });

    client.on('ready', () => {
      isReady = true;
      isConnected = true;
      const isLocal = clientOptions.url.includes('localhost') || clientOptions.url.includes('127.0.0.1');
      console.log(`[Redis] Connection established: Connected to ${isLocal ? 'LOCAL' : 'CLOUD'} Redis and ready for caching`);
    });

    client.on('error', (err) => {
      isReady = false;
      console.warn('[Redis] Client error:', err.message);
    });

    client.on('end', () => {
      isReady = false;
      isConnected = false;
      console.log('[Redis] Connection closed');
    });

    client.on('reconnecting', () => {
      isReady = false;
      console.log('[Redis] Attempting to reconnect...');
    });

    await client.connect();
    return client;
  } catch (error) {
    console.warn('[Redis] Connection failed during init. Caching fallback active:', error.message);
    isReady = false;
    isConnected = false;
    return null;
  }
};

const getClient = () => client;

const isRedisReady = () => isReady && client !== null;

const getRedisStats = async () => {
  if (!isRedisReady()) {
    return {
      status: process.env.REDIS_ENABLED === 'false' ? 'disabled' : 'disconnected',
      latency: null,
      memory: null
    };
  }

  try {
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;

    const info = await client.info('memory');
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';

    return {
      status: 'connected',
      latency: `${latency} ms`,
      memory
    };
  } catch (err) {
    return {
      status: `error: ${err.message}`,
      latency: null,
      memory: null
    };
  }
};

module.exports = {
  initRedis,
  getClient,
  isRedisReady,
  getRedisStats
};
