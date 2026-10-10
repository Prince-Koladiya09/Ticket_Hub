import { User } from './user.model.js';

/** Public projection of a user: never leaks hashes. */
export const toPublic = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  isVerified: u.isVerified,
});

export const createUser = (data) => User.create(data);

export const findById = (id) => User.findById(id);

export const findByEmailWithPassword = (email) =>
  User.findOne({ email }).select('+passwordHash');

export const findByVerifyTokenHash = (hash) =>
  User.findOne({ verifyTokenHash: hash }).select('+verifyTokenHash');

export async function setSuspended(id, suspended) {
  return User.findByIdAndUpdate(id, { isSuspended: suspended }, { new: true });
}
