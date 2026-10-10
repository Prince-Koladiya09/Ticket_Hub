import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';
import { conflict, forbidden, unauthorized, badRequest } from '../../common/errors.js';
import {
  createUser,
  findById,
  findByEmailWithPassword,
  findByVerifyTokenHash,
  toPublic,
} from '../users/users.service.js';
import { issueRefreshToken, revokeFamilyByToken, rotateRefreshToken } from './token.service.js';

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TTL,
  });
}

async function startSession(user) {
  const refresh = await issueRefreshToken(user.id);
  return { user: toPublic(user), accessToken: signAccessToken(user), refresh };
}

export async function register({ name, email, password, role }) {
  if (await findByEmailWithPassword(email)) {
    throw conflict('Email already registered', 'EMAIL_TAKEN');
  }
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const verifyToken = crypto.randomBytes(24).toString('hex');
  const user = await createUser({ name, email, passwordHash, role, verifyTokenHash: sha256(verifyToken) });

  // TODO(notifications): replace with an emailed link once the email queue exists.
  logger.info({ email, verifyToken }, 'email verification token generated');

  return startSession(user);
}

export async function login({ email, password }) {
  const user = await findByEmailWithPassword(email);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  if (user.isSuspended) throw forbidden('This account has been suspended', 'ACCOUNT_SUSPENDED');
  return startSession(user);
}

export async function refresh(rawToken) {
  if (!rawToken) throw unauthorized('Missing refresh token', 'INVALID_REFRESH_TOKEN');
  const { userId, next } = await rotateRefreshToken(rawToken);
  const user = await findById(userId);
  if (!user) throw unauthorized('User no longer exists', 'INVALID_REFRESH_TOKEN');
  // Suspension takes effect here: access tokens are short-lived and stateless, refresh is the choke point.
  if (user.isSuspended) throw forbidden('This account has been suspended', 'ACCOUNT_SUSPENDED');
  return { user: toPublic(user), accessToken: signAccessToken(user), refresh: next };
}

export async function logout(rawToken) {
  if (rawToken) await revokeFamilyByToken(rawToken);
}

export async function verifyEmail(token) {
  const user = await findByVerifyTokenHash(sha256(token));
  if (!user) throw badRequest('Invalid or already used verification link', undefined, 'INVALID_VERIFY_TOKEN');
  user.isVerified = true;
  user.verifyTokenHash = undefined;
  await user.save();
}
