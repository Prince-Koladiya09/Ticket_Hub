import crypto from 'node:crypto';
import { redis } from '../config/redis.js';
import { logger } from './logger.js';
import { cacheRequests } from './metrics.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// +-10% jitter so keys written together don't all expire together.
const jitter = (ttl) => Math.max(1, Math.round(ttl * (0.9 + Math.random() * 0.2)));
const warn = (err) => logger.warn({ err: err?.message }, 'cache error (continuing without cache)');

/**
 * Cache-aside with stampede protection.
 *
 * On a miss, exactly one caller (the one that wins a short `SET NX` mutex) runs `loader` and fills
 * the cache; concurrent callers wait briefly for that value instead of all hitting MongoDB at once.
 * If Redis is unavailable the loader just runs, so caching can only ever make things faster, not break them.
 * `null`/`undefined` results are never cached.
 */
export async function cacheAside(key, ttlSeconds, loader, { lockSeconds = 5, waitMs = 1500 } = {}) {
  try {
    const hit = await redis.get(key);
    if (hit !== null) {
      cacheRequests.inc({ result: 'hit' });
      return JSON.parse(hit);
    }
  } catch (err) {
    warn(err);
    return loader();
  }
  cacheRequests.inc({ result: 'miss' });

  const mutex = `lock:${key}`;
  let owner = false;
  try {
    owner = (await redis.set(mutex, '1', 'EX', lockSeconds, 'NX')) === 'OK';
  } catch (err) {
    warn(err);
    return loader();
  }

  if (owner) {
    try {
      const value = await loader();
      if (value !== null && value !== undefined) {
        await redis.set(key, JSON.stringify(value), 'EX', jitter(ttlSeconds)).catch(warn);
      }
      return value;
    } finally {
      await redis.del(mutex).catch(warn);
    }
  }

  // Another request is already loading this key: poll for its result.
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await sleep(40);
    const value = await redis.get(key).catch(() => null);
    if (value !== null) return JSON.parse(value);
  }
  return loader();
}

export const invalidate = (...keys) => (keys.length ? redis.del(...keys).catch(warn) : Promise.resolve());

/**
 * Versioned keys: instead of hunting down every cached list that might contain a changed event,
 * list keys embed a version number and a write simply bumps it. Old entries become unreachable
 * and expire on their own TTL.
 */
const versionKey = (name) => `cache:version:${name}`;
export const getVersion = async (name) => (await redis.get(versionKey(name)).catch(() => null)) ?? '0';
export const bumpVersion = (name) => redis.incr(versionKey(name)).catch(warn);

export const hashParams = (params) => crypto.createHash('sha1').update(JSON.stringify(params)).digest('hex').slice(0, 16);
