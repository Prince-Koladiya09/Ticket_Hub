import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './common/logger.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (req, res) => res.json({ name: 'tickethub-api', status: 'ok' }));

  return app;
}
