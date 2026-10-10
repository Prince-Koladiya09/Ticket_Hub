import express from 'express';
import cookieParser from 'cookie-parser';
import { requestLogger } from './common/requestLogger.js';
import { errorHandler, notFoundHandler } from './common/errorHandler.js';
import { healthRouter } from './common/health.routes.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/health', healthRouter);
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
