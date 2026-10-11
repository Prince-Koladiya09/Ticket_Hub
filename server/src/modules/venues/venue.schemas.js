import { z } from 'zod';
import { idParams } from '../../common/zod.js';

const section = z.object({
  name: z.string().trim().min(1).max(40),
  rows: z.coerce.number().int().min(1).max(50),
  cols: z.coerce.number().int().min(1).max(50),
  tier: z.string().trim().max(40).optional(),
});

export const createVenueSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(80),
    address: z.string().trim().max(200).optional(),
    sections: z
      .array(section)
      .min(1)
      .max(10)
      .refine((s) => new Set(s.map((x) => x.name.toLowerCase())).size === s.length, 'Section names must be unique'),
  }),
};

export const listVenuesSchema = {
  query: z.object({ city: z.string().trim().max(80).optional() }),
};

export const getVenueSchema = { params: idParams };
