import './config/models.js';
import { connectMongo, disconnectMongo } from './config/db.js';
import { connectRedis, redis } from './config/redis.js';
import { logger } from './common/logger.js';
import { bullConnection } from './queues/connection.js';
import { startWorkers } from './workers/index.js';

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'));

async function boot() {
  await connectMongo();
  await connectRedis();
  const workers = await startWorkers();
  logger.info({ workers: workers.map((w) => w.name) }, 'workers started');

  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'worker shutting down');
    // Let in-flight jobs finish, then stop.
    await Promise.all(workers.map((w) => w.close()));
    await Promise.allSettled([disconnectMongo(), redis.quit(), bullConnection.quit()]);
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot().catch((err) => {
  logger.fatal({ err }, 'worker failed to start');
  process.exit(1);
});
