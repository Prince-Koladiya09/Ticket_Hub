import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCursor, encodeCursor } from '../src/common/cursor.js';

test('cursor round-trips', () => {
  const payload = { s: '2026-12-20T18:30:00.000Z', i: '6acf1e94a1a74ea00780e65a' };
  assert.deepEqual(decodeCursor(encodeCursor(payload)), payload);
});

test('cursor is URL-safe', () => {
  const c = encodeCursor({ s: '???>>>', i: '~~~' });
  assert.match(c, /^[A-Za-z0-9_-]+$/);
});

test('garbage cursors are rejected with INVALID_CURSOR', () => {
  assert.throws(() => decodeCursor('not-a-cursor!!'), (e) => e.code === 'INVALID_CURSOR');
  assert.throws(() => decodeCursor(Buffer.from('123').toString('base64url')), (e) => e.code === 'INVALID_CURSOR');
});
