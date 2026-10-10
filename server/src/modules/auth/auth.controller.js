import { asyncHandler } from '../../common/asyncHandler.js';
import { created, ok } from '../../common/response.js';
import { env, isProd } from '../../config/env.js';
import * as auth from './auth.service.js';

const COOKIE = 'rt';

// The refresh token lives in an httpOnly cookie scoped to the auth routes only,
// so JavaScript (and therefore XSS) can never read it.
function setRefreshCookie(res, { token, expiresAt }) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/v1/auth',
    expires: expiresAt,
  });
}

const clearRefreshCookie = (res) => res.clearCookie(COOKIE, { path: '/api/v1/auth' });

function sessionResponse(res, { user, accessToken, refresh }, status = 200) {
  setRefreshCookie(res, refresh);
  return ok(res, { user, accessToken }, undefined, status);
}

export const register = asyncHandler(async (req, res) => {
  sessionResponse(res, await auth.register(req.body), 201);
});

export const login = asyncHandler(async (req, res) => {
  sessionResponse(res, await auth.login(req.body));
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    sessionResponse(res, await auth.refresh(req.cookies?.[COOKIE]));
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await auth.logout(req.cookies?.[COOKIE]);
  clearRefreshCookie(res);
  ok(res, { loggedOut: true });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await auth.verifyEmail(req.query.token);
  res.redirect(`${env.CLIENT_URL.split(',')[0]}/login?verified=1`);
});
