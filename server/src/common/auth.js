import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from './errors.js';

const bearer = (req) => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
};

function decode(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return { id: payload.sub, role: payload.role };
}

/** Requires a valid access token and sets req.user = { id, role }. */
export function authenticate(req, res, next) {
  const token = bearer(req);
  if (!token) return next(unauthorized('Missing access token'));
  try {
    req.user = decode(token);
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    next(unauthorized(expired ? 'Access token expired' : 'Invalid access token', expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'));
  }
}

/** Sets req.user when a valid token is present, but never rejects the request. */
export function optionalAuth(req, res, next) {
  const token = bearer(req);
  if (token) {
    try {
      req.user = decode(token);
    } catch {
      /* treat as anonymous */
    }
  }
  next();
}

/** Role-based access control. Use after authenticate(). */
export const authorize = (...roles) => (req, res, next) =>
  req.user && roles.includes(req.user.role)
    ? next()
    : next(forbidden('You do not have permission to perform this action'));
