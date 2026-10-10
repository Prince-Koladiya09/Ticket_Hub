import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestLogger } from './common/requestLogger.js';
import { errorHandler, notFoundHandler } from './common/errorHandler.js';
import { globalLimiter } from './common/rateLimit.js';
import { healthRouter } from './common/health.routes.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Nginx / a load balancer: trust one proxy hop so req.ip is the real client IP.
  app.set('trust proxy', 1);

  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL.split(','), credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/health', healthRouter);
  app.use('/api/v1', globalLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
