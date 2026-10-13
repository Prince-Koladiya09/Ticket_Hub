import { startExpiryWorker } from './expiry.worker.js';

/** Every worker registers itself here; worker.js starts them all. */
export async function startWorkers() {
  return [await startExpiryWorker()];
}
