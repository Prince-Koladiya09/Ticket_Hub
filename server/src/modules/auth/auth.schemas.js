import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(120);

export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72)
      .regex(/[A-Za-z]/, 'Password needs a letter')
      .regex(/\d/, 'Password needs a number'),
    // Public sign-up can only create attendees or organizers. Admins are seeded.
    role: z.enum(['user', 'organizer']).default('user'),
  }),
};

export const loginSchema = {
  body: z.object({ email, password: z.string().min(1).max(72) }),
};

export const verifyEmailSchema = {
  query: z.object({ token: z.string().min(10).max(200) }),
};
