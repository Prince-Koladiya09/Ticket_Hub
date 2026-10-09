import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../common/logger.js';

/**
 * Shared Redis client used for locks, cache and rate limiting.
 * enableOfflineQueue=false makes commands fail fast while Redis is down instead of
 * piling up in memory, so callers can degrade gracefully (rate limiter fails open, etc).
 */
export const redis = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 2,
  retryStrategy: (attempt) => Math.min(attempt * 200, 3000),
});

redis.on('error', (err) => logger.error({ err: err.message }, 'redis error'));

/** A separate connection for pub/sub, BullMQ etc. */
export function createRedis(options = {}) {
  const client = new Redis(env.REDIS_URL, options);
  client.on('error', (err) => logger.error({ err: err.message }, 'redis error'));
  return client;
}

export function connectRedis() {
  if (redis.status === 'ready') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
    redis.once('ready', () => {
      clearTimeout(timer);
      logger.info('Redis connected');
      resolve();
    });
  });
}
