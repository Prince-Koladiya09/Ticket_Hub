import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { unauthorized } from '../../common/errors.js';
import { RefreshToken } from './refreshToken.model.js';

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

export async function issueRefreshToken(userId, familyId = crypto.randomUUID()) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ userId, familyId, tokenHash: sha256(raw), expiresAt });
  return { token: raw, expiresAt, familyId };
}

/**
 * Rotation with reuse detection.
 * The old token is revoked atomically (findOneAndUpdate), so two concurrent refreshes with the same
 * token cannot both succeed. Presenting an already-revoked token means it was stolen or replayed,
 * so the entire family is revoked and the user must log in again.
 */
export async function rotateRefreshToken(raw) {
  const tokenHash = sha256(raw);
  const doc = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { revokedAt: new Date() },
  );

  if (!doc) {
    const reused = await RefreshToken.findOne({ tokenHash });
    if (reused) {
      await RefreshToken.updateMany({ familyId: reused.familyId, revokedAt: null }, { revokedAt: new Date() });
      throw unauthorized('Refresh token reuse detected, please log in again', 'TOKEN_REUSE');
    }
    throw unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const next = await issueRefreshToken(doc.userId, doc.familyId);
  await RefreshToken.updateOne({ _id: doc._id }, { replacedByHash: sha256(next.token) });
  return { userId: doc.userId, next };
}

export async function revokeFamilyByToken(raw) {
  const doc = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (doc) await RefreshToken.updateMany({ familyId: doc.familyId, revokedAt: null }, { revokedAt: new Date() });
}

export const revokeAllForUser = (userId) =>
  RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
