import { Queue } from 'bullmq';
import { logger } from '../common/logger.js';
import { bullConnection as connection } from './connection.js';

/**
 * Slow or failure-prone work (email, PDFs, expiry) runs in the worker process, never in a request.
 * Jobs are retried with exponential backoff; jobs that exhaust their attempts stay in the
 * queue's "failed" set for 7 days so they can be inspected and replayed (our dead-letter store).
 */
const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

function makeQueue(name, overrides = {}) {
  const queue = new Queue(name, { connection, defaultJobOptions: { ...defaultJobOptions, ...overrides } });
  queue.on('error', (err) => logger.error({ queue: name, err: err.message }, 'queue error'));
  return queue;
}

export const emailQueue = makeQueue('email');
export const ticketQueue = makeQueue('tickets', { attempts: 3 });
export const expiryQueue = makeQueue('booking-expiry', { attempts: 3 });

export const QUEUE_NAMES = { email: 'email', tickets: 'tickets', expiry: 'booking-expiry' };
