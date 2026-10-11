import { z } from 'zod';
import { idParams } from '../../common/zod.js';

export const suspendSchema = {
  params: idParams,
  body: z.object({ suspended: z.boolean() }),
};
