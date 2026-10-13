import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/asyncHandler.js';
import { authenticate, authorize } from '../../common/auth.js';
import { ok } from '../../common/response.js';
import { validate } from '../../common/validate.js';
import { objectId } from '../../common/zod.js';
import * as tickets from './tickets.service.js';

const router = Router();
router.use(authenticate);

const bookingParams = { params: z.object({ bookingId: objectId }) };

// Registered before the :bookingId routes so "check-in" is never read as an id.
router.post(
  '/check-in',
  authorize('organizer', 'admin'),
  validate({ body: z.object({ qrToken: z.string().min(10).max(100) }) }),
  asyncHandler(async (req, res) => ok(res, await tickets.checkIn(req.user, req.body.qrToken))),
);

router.get(
  '/:bookingId',
  validate(bookingParams),
  asyncHandler(async (req, res) => ok(res, await tickets.getTicket(req.user, req.params.bookingId))),
);

router.get(
  '/:bookingId/pdf',
  validate(bookingParams),
  asyncHandler(async (req, res) => {
    const file = await tickets.getTicketPdfPath(req.user, req.params.bookingId);
    res.download(file, `ticket-${req.params.bookingId}.pdf`);
  }),
);

export const routes = [{ path: '/tickets', router }];
