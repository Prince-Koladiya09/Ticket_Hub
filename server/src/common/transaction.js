import mongoose from 'mongoose';
import { env } from '../config/env.js';

/**
 * Runs `fn(session)` inside a MongoDB transaction (retrying transient errors).
 * With USE_TRANSACTIONS=false the callback runs without a session: fine for a throwaway standalone
 * mongod, but NOT atomic - the unique index on booked seats is then the only guard.
 */
export async function withTransaction(fn) {
  if (!env.USE_TRANSACTIONS) return fn(undefined);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
