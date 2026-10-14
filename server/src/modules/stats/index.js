import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { authenticate, authorize } from '../../common/auth.js';
import { ok } from '../../common/response.js';
import { validate } from '../../common/validate.js';
import { idParams } from '../../common/zod.js';
import * as stats from './stats.service.js';

const organizer = Router();
organizer.get(
  '/events/:id/stats',
  authenticate,
  authorize('organizer', 'admin'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => ok(res, await stats.organizerEventStats(req.user, req.params.id))),
);

const admin = Router();
admin.get(
  '/stats',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => ok(res, await stats.platformStats())),
);

export const routes = [
  { path: '/organizer', router: organizer },
  { path: '/admin', router: admin },
];
