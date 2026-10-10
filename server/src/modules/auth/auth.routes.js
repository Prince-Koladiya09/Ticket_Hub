import { Router } from 'express';
import { validate } from '../../common/validate.js';
import * as c from './auth.controller.js';
import { loginSchema, registerSchema, verifyEmailSchema } from './auth.schemas.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), c.register);
authRouter.post('/login', validate(loginSchema), c.login);
authRouter.get('/verify-email', validate(verifyEmailSchema), c.verifyEmail);
