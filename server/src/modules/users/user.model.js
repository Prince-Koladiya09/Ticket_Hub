import mongoose from 'mongoose';
import { baseOptions } from '../../common/schemaOptions.js';

export const ROLES = ['user', 'organizer', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user' },
    isVerified: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    verifyTokenHash: { type: String, select: false },
  },
  baseOptions,
);

export const User = mongoose.model('User', userSchema);
