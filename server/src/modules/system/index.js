import { Router } from 'express';
import { env } from '../../config/env.js';

const router = Router();

router.get('/ping', (req, res) => {
  res.json({ success: true, data: { pong: true, time: new Date().toISOString() } });
});

// Values the UI needs so it never hardcodes server policy.
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      seatLockTtl: env.SEAT_LOCK_TTL,
      maxSeatsPerBooking: env.MAX_SEATS_PER_BOOKING,
      paymentsEnabled: false,
      devConfirmEnabled: env.ENABLE_DEV_CONFIRM && env.NODE_ENV !== 'production',
    },
  });
});

export const routes = [{ path: '/', router }];
