import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGO_URI: z.string().default('mongodb://localhost:27017/tickethub?directConnection=true'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  SEAT_LOCK_TTL: z.coerce.number().int().min(5).default(300),
  MAX_SEATS_PER_BOOKING: z.coerce.number().int().min(1).max(20).default(6),
  // MongoDB transactions need a replica set (docker-compose provides one). Disable only for a plain standalone mongod.
  USE_TRANSACTIONS: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  // Lets a logged-in user confirm their own hold without paying. Dev/demo only; ignored in production.
  ENABLE_DEV_CONFIRM: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  // Leave SMTP_HOST empty in development: emails are logged instead of delivered.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('TicketHub <no-reply@tickethub.local>'),
  STORAGE_DIR: z.string().default('./storage'),
  CANCELLATION_CUTOFF_HOURS: z.coerce.number().int().min(0).default(24),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
