import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-123456';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-123456';

const { redis, connectRedis } = await import('../src/config/redis.js');
const lock = await import('../src/modules/booking/seatLock.service.js');

let available = true;
try {
  await connectRedis();
} catch {
  available = false;
}

after(() => redis.disconnect());

const t = (name, fn) => test(name, { skip: !available && 'Redis is not available' }, fn);
const id = () => crypto.randomBytes(12).toString('hex');

t('locks free seats and sets a TTL', async () => {
  const eventId = id();
  const seats = [id(), id()];
  const res = await lock.lockSeats({ eventId, seatIds: seats, ownerId: 'b1', ttl: 60 });
  assert.equal(res.ok, true);
  const ttl = await redis.ttl(lock.lockKey(eventId, seats[0]));
  assert.ok(ttl > 55 && ttl <= 60, `unexpected ttl ${ttl}`);
});

t('a second owner cannot lock a held seat and learns which seats conflict', async () => {
  const eventId = id();
  const [a, b] = [id(), id()];
  await lock.lockSeats({ eventId, seatIds: [a], ownerId: 'b1' });
  const res = await lock.lockSeats({ eventId, seatIds: [a, b], ownerId: 'b2' });
  assert.equal(res.ok, false);
  assert.deepEqual(res.conflicts, [a]);
});

t('multi-seat locking is all-or-nothing (no partial holds left behind)', async () => {
  const eventId = id();
  const [a, b, c] = [id(), id(), id()];
  await lock.lockSeats({ eventId, seatIds: [b], ownerId: 'b1' });
  const res = await lock.lockSeats({ eventId, seatIds: [a, b, c], ownerId: 'b2' });
  assert.equal(res.ok, false);
  assert.equal(await redis.exists(lock.lockKey(eventId, a)), 0, 'seat a must not stay locked');
  assert.equal(await redis.exists(lock.lockKey(eventId, c)), 0, 'seat c must not stay locked');
});

t('only the owner can release a lock', async () => {
  const eventId = id();
  const [a, b] = [id(), id()];
  await lock.lockSeats({ eventId, seatIds: [a, b], ownerId: 'owner' });
  assert.equal(await lock.releaseSeats({ eventId, seatIds: [a, b], ownerId: 'intruder' }), 0);
  assert.equal(await redis.exists(lock.lockKey(eventId, a)), 1);
  assert.equal(await lock.releaseSeats({ eventId, seatIds: [a, b], ownerId: 'owner' }), 2);
  assert.equal(await redis.exists(lock.lockKey(eventId, a)), 0);
});

t('only the owner can extend a lock', async () => {
  const eventId = id();
  const a = id();
  await lock.lockSeats({ eventId, seatIds: [a], ownerId: 'owner', ttl: 10 });
  assert.equal(await lock.extendSeats({ eventId, seatIds: [a], ownerId: 'intruder', ttl: 500 }), 0);
  assert.equal(await lock.extendSeats({ eventId, seatIds: [a], ownerId: 'owner', ttl: 500 }), 1);
  assert.ok((await redis.ttl(lock.lockKey(eventId, a))) > 400);
});

t('100 concurrent requests for the same seat: exactly one wins', async () => {
  const eventId = id();
  const seat = id();
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) => lock.lockSeats({ eventId, seatIds: [seat], ownerId: `booking-${i}` })),
  );
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => !r.ok).length, 99);
});

t('overlapping multi-seat requests never double-assign a seat', async () => {
  const eventId = id();
  const seats = Array.from({ length: 6 }, id);
  const pick = () => [...seats].sort(() => Math.random() - 0.5).slice(0, 3);
  const attempts = Array.from({ length: 80 }, (_, i) => ({ owner: `b-${i}`, seatIds: pick() }));
  const results = await Promise.all(attempts.map((a) => lock.lockSeats({ eventId, seatIds: a.seatIds, ownerId: a.owner })));

  const claimed = new Map();
  results.forEach((r, i) => {
    if (!r.ok) return;
    for (const s of attempts[i].seatIds) {
      assert.ok(!claimed.has(s), `seat ${s} was granted to ${claimed.get(s)} and ${attempts[i].owner}`);
      claimed.set(s, attempts[i].owner);
    }
  });
  assert.ok(claimed.size >= 3, 'at least one request should have succeeded');
});

t('an expired lock can be taken by someone else', async () => {
  const eventId = id();
  const a = id();
  assert.equal((await lock.lockSeats({ eventId, seatIds: [a], ownerId: 'b1', ttl: 1 })).ok, true);
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal((await lock.lockSeats({ eventId, seatIds: [a], ownerId: 'b2' })).ok, true);
});

t('getLocks reports owners of currently locked seats', async () => {
  const eventId = id();
  const [a, b, c] = [id(), id(), id()];
  await lock.lockSeats({ eventId, seatIds: [a, c], ownerId: 'bk' });
  const locks = await lock.getLocks(eventId, [a, b, c]);
  assert.equal(locks.get(a), 'bk');
  assert.equal(locks.has(b), false);
  assert.equal(locks.get(c), 'bk');
});
