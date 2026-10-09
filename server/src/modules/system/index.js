import { Router } from 'express';

const router = Router();

router.get('/ping', (req, res) => {
  res.json({ success: true, data: { pong: true, time: new Date().toISOString() } });
});

export const routes = [{ path: '/', router }];
