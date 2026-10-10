import { asyncHandler } from '../../common/asyncHandler.js';
import { created, ok } from '../../common/response.js';
import { env } from '../../config/env.js';
import * as auth from './auth.service.js';

export const register = asyncHandler(async (req, res) => {
  created(res, await auth.register(req.body));
});

export const login = asyncHandler(async (req, res) => {
  ok(res, await auth.login(req.body));
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await auth.verifyEmail(req.query.token);
  res.redirect(`${env.CLIENT_URL.split(',')[0]}/login?verified=1`);
});
