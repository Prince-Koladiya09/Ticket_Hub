import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { authenticate } from '../../common/auth.js';
import { rateLimit } from '../../common/rateLimit.js';
import { created, ok } from '../../common/response.js';
import { validate } from '../../common/validate.js';
import { bookingIdSchema, holdSchema, myBookingsSchema } from './booking.schemas.js';
import * as bookings from './booking.service.js';

export const bookingRouter = Router();
bookingRouter.use(authenticate);

// Holding seats is the hot, abusable endpoint, so it gets its own per-user limit.
const holdLimiter = rateLimit({ name: 'hold', points: 20, duration: 60, key: (req) => req.user.id });

bookingRouter.post(
  '/hold',
  holdLimiter,
  validate(holdSchema),
  asyncHandler(async (req, res) => {
    const booking = await bookings.holdSeats({ userId: req.user.id, ...req.body });
    created(res, { bookingId: booking.id, status: booking.status, totalAmount: booking.totalAmount, expiresAt: booking.expiresAt });
  }),
);

bookingRouter.get(
  '/me',
  validate(myBookingsSchema),
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await bookings.listMine(req.user.id, req.query);
    ok(res, items.map(bookings.toDto), { nextCursor, limit: req.query.limit });
  }),
);

bookingRouter.get(
  '/:id',
  validate(bookingIdSchema),
  asyncHandler(async (req, res) => ok(res, bookings.toDto(await bookings.getBooking(req.user, req.params.id)))),
);

bookingRouter.delete(
  '/:id/hold',
  validate(bookingIdSchema),
  asyncHandler(async (req, res) => {
    const booking = await bookings.releaseHold(req.user.id, req.params.id);
    ok(res, { bookingId: booking.id, status: booking.status });
  }),
);
