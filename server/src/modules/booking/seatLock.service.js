import { env } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import { seatLockAttempts } from '../../common/metrics.js';

/**
 * Seat locks live in Redis as plain keys with a TTL:
 *
 *     seatlock:{<eventId>}:<seatId>  ->  <bookingId>   (EX = SEAT_LOCK_TTL)
 *
 *  - The TTL is the release mechanism: abandoned checkouts free their seats with no cleanup job.
 *  - The value identifies the owner, so only the holder can release or extend a lock.
 *  - `{eventId}` is a Redis Cluster hash tag: all seats of an event land in the same slot, which
 *    keeps the multi-key Lua scripts below valid on a cluster.
 *
 * Multi-seat operations are Lua scripts because Redis runs a script atomically. Without that, two
 * users picking overlapping seats could each win a different seat and leave both holds half-complete.
 */

// Returns the list of conflicting keys; an empty list means every seat was locked. All-or-nothing.
const LOCK_LUA = `
local conflicts = {}
for _, key in ipairs(KEYS) do
  if redis.call('EXISTS', key) == 1 then conflicts[#conflicts + 1] = key end
end
if #conflicts > 0 then return conflicts end
for _, key in ipairs(KEYS) do
  redis.call('SET', key, ARGV[1], 'EX', ARGV[2])
end
return {}
`;

// Compare-and-delete: only removes locks owned by ARGV[1]. Returns how many were released.
const RELEASE_LUA = `
local released = 0
for _, key in ipairs(KEYS) do
  if redis.call('GET', key) == ARGV[1] then
    redis.call('DEL', key)
    released = released + 1
  end
end
return released
`;

// Compare-and-expire: refreshes the TTL of locks owned by ARGV[1]. Returns how many were extended.
const EXTEND_LUA = `
local extended = 0
for _, key in ipairs(KEYS) do
  if redis.call('GET', key) == ARGV[1] then
    redis.call('EXPIRE', key, ARGV[2])
    extended = extended + 1
  end
end
return extended
`;

// No numberOfKeys: the first argument of each call is the key count.
redis.defineCommand('lockSeats', { lua: LOCK_LUA });
redis.defineCommand('releaseSeats', { lua: RELEASE_LUA });
redis.defineCommand('extendSeats', { lua: EXTEND_LUA });

export const lockKey = (eventId, seatId) => `seatlock:{${eventId}}:${seatId}`;
const seatIdFromKey = (key) => key.slice(key.lastIndexOf(':') + 1);

/** Atomically lock every seat for `ownerId`, or none of them. */
export async function lockSeats({ eventId, seatIds, ownerId, ttl = env.SEAT_LOCK_TTL }) {
  const keys = seatIds.map((s) => lockKey(eventId, s));
  const conflicts = await redis.lockSeats(keys.length, ...keys, String(ownerId), ttl);
  seatLockAttempts.inc({ result: conflicts.length ? 'conflict' : 'success' });
  if (conflicts.length) return { ok: false, conflicts: conflicts.map(seatIdFromKey) };
  return { ok: true, expiresAt: new Date(Date.now() + ttl * 1000) };
}

/** Release locks held by `ownerId`. Locks that expired or belong to someone else are left alone. */
export async function releaseSeats({ eventId, seatIds, ownerId }) {
  if (!seatIds.length) return 0;
  const keys = seatIds.map((s) => lockKey(eventId, s));
  return redis.releaseSeats(keys.length, ...keys, String(ownerId));
}

/** Push the expiry of the owner's locks out again (used when the payment step begins). */
export async function extendSeats({ eventId, seatIds, ownerId, ttl = env.SEAT_LOCK_TTL }) {
  const keys = seatIds.map((s) => lockKey(eventId, s));
  return redis.extendSeats(keys.length, ...keys, String(ownerId), ttl);
}

/** Returns a Map(seatId -> ownerId) of the currently locked seats among `seatIds`. */
export async function getLocks(eventId, seatIds) {
  const locks = new Map();
  const CHUNK = 1000;
  for (let i = 0; i < seatIds.length; i += CHUNK) {
    const slice = seatIds.slice(i, i + CHUNK);
    const owners = await redis.mget(slice.map((s) => lockKey(eventId, s)));
    owners.forEach((owner, idx) => {
      if (owner) locks.set(String(slice[idx]), owner);
    });
  }
  return locks;
}
