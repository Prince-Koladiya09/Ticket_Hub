import { Worker } from 'bullmq';
import { logger } from '../common/logger.js';
import { sendTemplatedEmail } from '../modules/notifications/email.service.js';
import { bullConnection } from '../queues/connection.js';
import { QUEUE_NAMES } from '../queues/index.js';

export function startEmailWorker() {
  const worker = new Worker(QUEUE_NAMES.email, (job) => sendTemplatedEmail(job.data), {
    connection: bullConnection,
    concurrency: 5,
  });
  worker.on('failed', (job, err) =>
    logger.error({ job: job?.id, template: job?.name, attempt: job?.attemptsMade, err: err.message }, 'email job failed'),
  );
  return worker;
}
