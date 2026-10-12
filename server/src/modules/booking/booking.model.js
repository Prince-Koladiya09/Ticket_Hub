import mongoose from 'mongoose';
import { baseOptions } from '../../common/schemaOptions.js';

export const BOOKING_STATUS = ['PENDING', 'CONFIRMED', 'EXPIRED', 'FAILED', 'CANCELLED', 'REFUNDED'];

/**
 * PENDING   -> CONFIRMED (payment succeeded)
 * PENDING   -> EXPIRED   (hold timed out)  | CANCELLED (user released) | FAILED (payment failed)
 * CONFIRMED -> CANCELLED -> REFUNDED
 */
const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    seatIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Seat' }],
    status: { type: String, enum: BOOKING_STATUS, default: 'PENDING' },
    totalAmount: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
    confirmedAt: Date,
    cancelledAt: Date,
    paymentRef: String,
  },
  baseOptions,
);

bookingSchema.index({ userId: 1, _id: -1 }); // "my bookings", newest first
bookingSchema.index({ status: 1, expiresAt: 1 }); // expiry sweeper
bookingSchema.index({ eventId: 1, status: 1 }); // organizer stats

export const Booking = mongoose.model('Booking', bookingSchema);
