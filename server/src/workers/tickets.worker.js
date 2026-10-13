import { Worker } from 'bullmq';
import { logger } from '../common/logger.js';
import { generateTicketAndNotify } from '../modules/tickets/tickets.service.js';
import { bullConnection } from '../queues/connection.js';
import { QUEUE_NAMES } from '../queues/index.js';

export function startTicketWorker() {
  const worker = new Worker(QUEUE_NAMES.tickets, (job) => generateTicketAndNotify(job.data.bookingId), {
    connection: bullConnection,
    concurrency: 3,
  });
  worker.on('failed', (job, err) =>
    logger.error({ job: job?.id, attempt: job?.attemptsMade, err: err.message }, 'ticket job failed'),
  );
  return worker;
}
