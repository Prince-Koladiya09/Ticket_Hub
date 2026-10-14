import { Router } from 'express';
import { env } from '../config/env.js';
import { registry } from './metrics.js';

export const metricsRouter = Router();

metricsRouter.get('/', async (req, res) => {
  if (env.METRICS_TOKEN && req.headers.authorization !== `Bearer ${env.METRICS_TOKEN}`) {
    return res.status(401).send('unauthorized');
  }
  res.type(registry.contentType).send(await registry.metrics());
});
