import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectMongo, disconnectMongo } from './config/db.js';
import { connectRedis, redis } from './config/redis.js';
import { logger } from './common/logger.js';

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'));

async function boot() {
  await connectMongo();
  await connectRedis();

  const app = createApp();
  const server = http.createServer(app);
  server.listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));

  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await disconnectMongo().catch(() => {});
      await redis.quit().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
