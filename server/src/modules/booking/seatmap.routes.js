import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { optionalAuth } from '../../common/auth.js';
import { ok } from '../../common/response.js';
import { validate } from '../../common/validate.js';
import { idParams } from '../../common/zod.js';
import { getSeatMap } from './seatmap.service.js';

// Mounted under /events so the URL reads GET /events/:id/seats
export const seatMapRouter = Router();

seatMapRouter.get(
  '/:id/seats',
  optionalAuth,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store'); // availability must always be fresh
    ok(res, await getSeatMap(req.params.id, req.user));
  }),
);
