import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { authenticate, authorize, optionalAuth } from '../../common/auth.js';
import { created, ok } from '../../common/response.js';
import { validate } from '../../common/validate.js';
import { createEventSchema, eventIdSchema, listEventsSchema, updateEventSchema } from './event.schemas.js';
import * as events from './event.service.js';

export const eventRouter = Router();
const organizerOnly = [authenticate, authorize('organizer', 'admin')];

eventRouter.get(
  '/',
  validate(listEventsSchema),
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await events.listPublished(req.query);
    ok(res, items, { nextCursor, limit: req.query.limit });
  }),
);

eventRouter.get(
  '/mine',
  ...organizerOnly,
  asyncHandler(async (req, res) => ok(res, (await events.listMine(req.user.id)).map(events.toDto))),
);

eventRouter.get(
  '/:id',
  optionalAuth,
  validate(eventIdSchema),
  asyncHandler(async (req, res) => ok(res, await events.getEventView(req.params.id, req.user))),
);

eventRouter.post(
  '/',
  ...organizerOnly,
  validate(createEventSchema),
  asyncHandler(async (req, res) => created(res, (await events.createEvent(req.user, req.body)).toJSON())),
);

eventRouter.patch(
  '/:id',
  ...organizerOnly,
  validate(updateEventSchema),
  asyncHandler(async (req, res) => ok(res, (await events.updateEvent(req.user, req.params.id, req.body)).toJSON())),
);

eventRouter.post(
  '/:id/submit',
  ...organizerOnly,
  validate(eventIdSchema),
  asyncHandler(async (req, res) => ok(res, (await events.submitEvent(req.user, req.params.id)).toJSON())),
);

eventRouter.delete(
  '/:id',
  ...organizerOnly,
  validate(eventIdSchema),
  asyncHandler(async (req, res) => ok(res, (await events.cancelEvent(req.user, req.params.id)).toJSON())),
);
