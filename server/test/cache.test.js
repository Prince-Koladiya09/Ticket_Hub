import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-123456';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-123456';

const { redis, connectRedis } = await import('../src/config/redis.js');
const { cacheAside, bumpVersion, getVersion, hashParams } = await import('../src/common/cache.js');

let available = true;
try {
  await connectRedis();
} catch {
  available = false;
}
after(() => redis.disconnect());

const t = (name, fn) => test(name, { skip: !available && 'Redis is not available' }, fn);
const key = () => `test:cache:${crypto.randomBytes(6).toString('hex')}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

t('cache stampede: 50 concurrent misses run the loader once', async () => {
  const k = key();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    await sleep(150); // slow query
    return { hello: 'world' };
  };
  const results = await Promise.all(Array.from({ length: 50 }, () => cacheAside(k, 30, loader)));
  assert.equal(calls, 1);
  assert.ok(results.every((r) => r.hello === 'world'));
});

t('subsequent calls are served from cache', async () => {
  const k = key();
  let calls = 0;
  const loader = async () => ({ n: ++calls });
  await cacheAside(k, 30, loader);
  const second = await cacheAside(k, 30, loader);
  assert.equal(calls, 1);
  assert.equal(second.n, 1);
});

t('null results are not cached', async () => {
  const k = key();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return null;
  };
  await cacheAside(k, 30, loader);
  await cacheAside(k, 30, loader);
  assert.equal(calls, 2);
});

t('a failing loader releases the mutex so the next caller can retry', async () => {
  const k = key();
  await assert.rejects(() => cacheAside(k, 30, async () => { throw new Error('db down'); }), /db down/);
  const value = await cacheAside(k, 30, async () => 'recovered');
  assert.equal(value, 'recovered');
});

t('bumping a version makes old keys unreachable', async () => {
  const name = `v${crypto.randomBytes(4).toString('hex')}`;
  const before = await getVersion(name);
  await bumpVersion(name);
  assert.notEqual(await getVersion(name), before);
});

t('hashParams is stable for equal inputs and differs otherwise', () => {
  assert.equal(hashParams({ a: 1, b: 2 }), hashParams({ a: 1, b: 2 }));
  assert.notEqual(hashParams({ a: 1 }), hashParams({ a: 2 }));
});
