import { Router } from 'express';
import { asyncHandler } from '../../common/asyncHandler.js';
import { authenticate, authorize } from '../../common/auth.js';
import { created, ok } from '../../common/response.js';
import { validate } from '../../common/validate.js';
import { createVenueSchema, getVenueSchema, listVenuesSchema } from './venue.schemas.js';
import * as venues from './venues.service.js';

const router = Router();

router.get('/', validate(listVenuesSchema), asyncHandler(async (req, res) => ok(res, await venues.listVenues(req.query))));

router.get('/:id', validate(getVenueSchema), asyncHandler(async (req, res) => ok(res, await venues.getVenue(req.params.id))));

router.post(
  '/',
  authenticate,
  authorize('organizer', 'admin'),
  validate(createVenueSchema),
  asyncHandler(async (req, res) => created(res, await venues.createVenue(req.user.id, req.body))),
);

export const routes = [{ path: '/venues', router }];
