import { createRedis } from '../config/redis.js';

/** BullMQ requires maxRetriesPerRequest=null on its connection (blocking commands). */
export const bullConnection = createRedis({ maxRetriesPerRequest: null });
