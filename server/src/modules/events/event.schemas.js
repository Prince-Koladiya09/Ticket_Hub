import { z } from 'zod';
import { CATEGORIES } from './event.model.js';
import { idParams, objectId } from '../../common/zod.js';

const tier = z.object({
  name: z.string().trim().min(1).max(40),
  price: z.coerce.number().int().min(0).max(1_000_000),
});

const tiers = z
  .array(tier)
  .min(1)
  .max(8)
  .refine((t) => new Set(t.map((x) => x.name.toLowerCase())).size === t.length, 'Tier names must be unique');

const base = {
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(5000).optional(),
  category: z.enum(CATEGORIES),
  bannerUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  venueId: objectId,
  pricingTiers: tiers,
};

export const createEventSchema = {
  body: z.object({ ...base, category: base.category.default('other') }).refine((e) => e.startsAt > new Date(), {
    path: ['startsAt'],
    message: 'Event must start in the future',
  }),
};

export const updateEventSchema = {
  params: idParams,
  body: z
    .object({ ...base, venueId: base.venueId.optional(), pricingTiers: tiers.optional() })
    .partial()
    .refine((b) => Object.keys(b).length > 0, 'Nothing to update'),
};

export const eventIdSchema = { params: idParams };

export const rejectSchema = {
  params: idParams,
  body: z.object({ reason: z.string().trim().min(3).max(500) }),
};

export const listEventsSchema = {
  query: z.object({
    q: z.string().trim().max(100).optional(),
    city: z.string().trim().max(80).optional(),
    category: z.enum(CATEGORIES).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  }),
};
