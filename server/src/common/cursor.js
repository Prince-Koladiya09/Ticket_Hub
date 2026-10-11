import { badRequest } from './errors.js';

/**
 * Opaque cursors for keyset pagination. Unlike skip/limit, the cost of fetching page N
 * does not grow with N, and results don't shift when new rows are inserted mid-scroll.
 */
export const encodeCursor = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');

export function decodeCursor(cursor) {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null) throw new Error('bad cursor');
    return value;
  } catch {
    throw badRequest('Invalid cursor', undefined, 'INVALID_CURSOR');
  }
}
