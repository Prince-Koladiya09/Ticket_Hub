import { Router } from 'express';
import { authenticate } from '../../common/auth.js';
import { me } from './users.controller.js';

const router = Router();
router.get('/me', authenticate, me);

export const routes = [{ path: '/users', router }];
