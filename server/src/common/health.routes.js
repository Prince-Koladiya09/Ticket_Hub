import { Router } from 'express';
import mongoose from 'mongoose';
import { redis } from '../config/redis.js';

export const healthRouter = Router();

// Liveness: the process is up. Used by the container runtime to decide whether to restart.
healthRouter.get('/live', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// Readiness: dependencies are reachable. Used by the load balancer to decide whether to route traffic.
healthRouter.get('/ready', async (req, res) => {
  const mongo = mongoose.connection.readyState === 1;
  let redisOk = false;
  try {
    redisOk = (await redis.ping()) === 'PONG';
  } catch {
    redisOk = false;
  }
  const ready = mongo && redisOk;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    checks: { mongo, redis: redisOk },
  });
});
