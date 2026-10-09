import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { logger } from './logger.js';

/** Structured request logs; every request gets an id (honours an incoming x-request-id). */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: { ignore: (req) => req.url.startsWith('/health') },
});
