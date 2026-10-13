import { startEmailWorker } from './email.worker.js';
import { startExpiryWorker } from './expiry.worker.js';
import { startTicketWorker } from './tickets.worker.js';

/** Every worker registers itself here; worker.js starts them all. */
export async function startWorkers() {
  return [await startExpiryWorker(), startEmailWorker(), startTicketWorker()];
}
