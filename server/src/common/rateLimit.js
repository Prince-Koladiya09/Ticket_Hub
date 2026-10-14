import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

/**
 * Distributed rate limiter backed by Redis, so limits hold across all API instances.
 * If Redis is unavailable the insurance limiter (per-process memory) takes over:
 * we degrade to approximate limits instead of rejecting all traffic.
 *
 * rateLimit({ name, points, duration, key })  ->  `points` requests per `duration` seconds per key.
 */
export function rateLimit({ name, points, duration, key = (req) => req.ip }) {
  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: `rl:${name}`,
    points,
    duration,
    insuranceLimiter: new RateLimiterMemory({ points, duration }),
  });

  return async (req, res, next) => {
    try {
      const result = await limiter.consume(key(req));
      res.set('X-RateLimit-Remaining', String(result.remainingPoints));
      next();
    } catch (rejection) {
      if (rejection instanceof Error) {
        logger.warn({ err: rejection.message, limiter: name }, 'rate limiter error, failing open');
        return next();
      }
      res.set('Retry-After', String(Math.ceil(rejection.msBeforeNext / 1000)));
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please slow down'));
    }
  };
}

export const globalLimiter = rateLimit({ name: 'global', points: env.GLOBAL_RATE_LIMIT, duration: 60 });
// Strict limit on credential endpoints to slow down brute-force attempts.
export const authLimiter = rateLimit({ name: 'auth', points: env.AUTH_RATE_LIMIT, duration: 60 });
