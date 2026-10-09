import express from 'express';
import { requestLogger } from './common/requestLogger.js';
import { errorHandler, notFoundHandler } from './common/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (req, res) => res.json({ name: 'tickethub-api', status: 'ok' }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
