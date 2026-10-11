import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { authenticate, authorize } from '../../common/auth.js';
import { badRequest, notFound } from '../../common/errors.js';
import { ok } from '../../common/response.js';
import { validate } from '../../common/validate.js';
import { eventIdSchema, rejectSchema } from '../events/event.schemas.js';
import * as events from '../events/event.service.js';
import { revokeAllForUser } from '../auth/token.service.js';
import { setSuspended, toPublic } from '../users/users.service.js';
import { suspendSchema } from './admin.schemas.js';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get(
  '/events/pending',
  asyncHandler(async (req, res) => ok(res, (await events.listPending()).map(events.toDto))),
);

router.post(
  '/events/:id/approve',
  validate(eventIdSchema),
  asyncHandler(async (req, res) => ok(res, (await events.approveEvent(req.params.id)).toJSON())),
);

router.post(
  '/events/:id/reject',
  validate(rejectSchema),
  asyncHandler(async (req, res) => ok(res, (await events.rejectEvent(req.params.id, req.body.reason)).toJSON())),
);

router.patch(
  '/users/:id/suspend',
  validate(suspendSchema),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) throw badRequest('You cannot suspend yourself', undefined, 'SELF_SUSPEND');
    const user = await setSuspended(req.params.id, req.body.suspended);
    if (!user) throw notFound('User not found');
    // Kill active sessions immediately; the user can no longer refresh their access token.
    if (req.body.suspended) await revokeAllForUser(user.id);
    ok(res, toPublic(user));
  }),
);

export const routes = [{ path: '/admin', router }];
