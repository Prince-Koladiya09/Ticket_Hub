import { Router } from 'express';
import { validate } from '../../common/validate.js';
import { authLimiter } from '../../common/rateLimit.js';
import * as c from './auth.controller.js';
import { loginSchema, registerSchema, verifyEmailSchema } from './auth.schemas.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), c.register);
authRouter.post('/login', authLimiter, validate(loginSchema), c.login);
authRouter.post('/refresh', authLimiter, c.refresh);
authRouter.post('/logout', c.logout);
authRouter.get('/verify-email', validate(verifyEmailSchema), c.verifyEmail);
