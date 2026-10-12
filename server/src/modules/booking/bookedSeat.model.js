import mongoose from 'mongoose';

/**
 * One document per (event, seat) that has been sold.
 *
 * The UNIQUE index below is the last line of defence against double booking: even if Redis is
 * flushed, a lock is lost, or a bug slips through, MongoDB refuses to store two bookings for one seat.
 */
const bookedSeatSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    seatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bookedSeatSchema.index({ eventId: 1, seatId: 1 }, { unique: true });
bookedSeatSchema.index({ bookingId: 1 });

export const BookedSeat = mongoose.model('BookedSeat', bookedSeatSchema);
