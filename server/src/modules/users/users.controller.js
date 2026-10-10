import { asyncHandler } from '../../common/asyncHandler.js';
import { notFound } from '../../common/errors.js';
import { ok } from '../../common/response.js';
import { findById, toPublic } from './users.service.js';

export const me = asyncHandler(async (req, res) => {
  const user = await findById(req.user.id);
  if (!user) throw notFound('User not found');
  ok(res, toPublic(user));
});
