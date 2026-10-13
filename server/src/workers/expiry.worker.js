import { Worker } from 'bullmq';
import { logger } from '../common/logger.js';
import { expireBooking, sweepExpired } from '../modules/booking/booking.service.js';
import { bullConnection } from '../queues/connection.js';
import { expiryQueue, QUEUE_NAMES } from '../queues/index.js';

export async function startExpiryWorker() {
  const worker = new Worker(
    QUEUE_NAMES.expiry,
    async (job) => {
      if (job.name === 'sweep') return { expired: await sweepExpired() };
      return { expired: await expireBooking(job.data.bookingId) };
    },
    { connection: bullConnection, concurrency: 10 },
  );
  worker.on('failed', (job, err) => logger.error({ job: job?.id, err: err.message }, 'expiry job failed'));

  // Repeatable safety-net job. upsert is idempotent, so every worker instance can call it on boot.
  await expiryQueue.upsertJobScheduler('expiry-sweeper', { every: 60_000 }, { name: 'sweep' });
  return worker;
}
