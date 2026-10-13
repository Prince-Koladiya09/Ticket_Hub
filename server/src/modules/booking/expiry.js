import { expiryQueue } from '../../queues/index.js';
import { logger } from '../../common/logger.js';

const jobId = (bookingId) => `expire-${bookingId}`;

/** Schedules a delayed job that will expire the booking if it is still unpaid at `expiresAt`. */
export async function scheduleExpiry(bookingId, expiresAt) {
  try {
    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now()) + 500;
    await expiryQueue.add('expire', { bookingId: String(bookingId) }, { jobId: jobId(bookingId), delay });
  } catch (err) {
    // Not fatal: the Redis TTL still frees the seats and the sweeper will mark the booking expired.
    logger.warn({ err: err.message, bookingId }, 'could not schedule expiry job');
  }
}

export async function cancelExpiry(bookingId) {
  try {
    await expiryQueue.remove(jobId(bookingId));
  } catch {
    /* job already ran or never existed */
  }
}
