import { z } from 'zod';
import { env } from '../../config/env.js';
import { idParams, objectId } from '../../common/zod.js';

export const holdSchema = {
  body: z.object({
    eventId: objectId,
    seatIds: z.array(objectId).min(1).max(env.MAX_SEATS_PER_BOOKING),
  }),
};

export const bookingIdSchema = { params: idParams };

export const myBookingsSchema = {
  query: z.object({
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
};
