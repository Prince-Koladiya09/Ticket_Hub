import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { decodeCursor, encodeCursor } from '../../common/cursor.js';
import { emitSeats, emitToUser } from '../../common/realtime.js';
import { assertBookable } from '../events/event.service.js';
import { getSeatsByIds } from '../seats/seats.service.js';
import { BookedSeat } from './bookedSeat.model.js';
import { Booking } from './booking.model.js';
import { cancelExpiry, scheduleExpiry } from './expiry.js';
import { lockSeats, releaseSeats } from './seatLock.service.js';

/** Serializes a booking, with seats/event included when they were populated. */
export function toDto(b) {
  const event = b.eventId && typeof b.eventId === 'object' && b.eventId.title ? b.eventId : null;
  return {
    id: b.id,
    status: b.status,
    totalAmount: b.totalAmount,
    expiresAt: b.expiresAt,
    confirmedAt: b.confirmedAt,
    cancelledAt: b.cancelledAt,
    createdAt: b.createdAt,
    eventId: String(event ? event.id : b.eventId),
    event: event && { id: event.id, title: event.title, startsAt: event.startsAt, city: event.city },
    seats: b.seatIds
      .filter((s) => s && typeof s === 'object' && s.section)
      .map((s) => ({ id: s.id, section: s.section, row: s.row, number: s.number, tier: s.tier, price: s.price })),
    seatIds: b.seatIds.map((s) => String(s?._id ?? s)),
  };
}

/**
 * Holds seats for a user: Redis lock first (fast, atomic), then a PENDING booking in MongoDB.
 * If persisting the booking fails, the locks are rolled back so seats never stay stuck.
 */
export async function holdSeats({ userId, eventId, seatIds }) {
  const ids = [...new Set(seatIds)];
  await assertBookable(eventId);

  const seats = await getSeatsByIds(eventId, ids);
  if (seats.length !== ids.length) {
    throw badRequest('One or more seats do not belong to this event', undefined, 'INVALID_SEATS');
  }

  // Anti-hoarding: one active hold per user per event.
  const existing = await Booking.findOne({ userId, eventId, status: 'PENDING', expiresAt: { $gt: new Date() } });
  if (existing) {
    throw conflict('You already have an active hold for this event', 'ACTIVE_HOLD_EXISTS', { bookingId: existing.id });
  }

  const sold = await BookedSeat.find({ eventId, seatId: { $in: ids } }).select('seatId').lean();
  if (sold.length) {
    throw conflict('Some of these seats were just booked', 'SEATS_UNAVAILABLE', {
      conflicts: sold.map((s) => String(s.seatId)),
    });
  }

  const bookingId = new mongoose.Types.ObjectId();
  const lock = await lockSeats({ eventId, seatIds: ids, ownerId: bookingId });
  if (!lock.ok) {
    throw conflict('Some of these seats are being held by someone else', 'SEATS_UNAVAILABLE', {
      conflicts: lock.conflicts,
    });
  }

  try {
    const booking = await Booking.create({
      _id: bookingId,
      userId,
      eventId,
      seatIds: ids,
      totalAmount: seats.reduce((sum, s) => sum + s.price, 0),
      expiresAt: lock.expiresAt,
    });
    emitSeats(eventId, 'seats:locked', ids);
    await scheduleExpiry(booking._id, booking.expiresAt);
    return booking;
  } catch (err) {
    await releaseSeats({ eventId, seatIds: ids, ownerId: bookingId });
    throw err;
  }
}

/** User gives up their hold before paying. */
export async function releaseHold(userId, bookingId) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, userId, status: 'PENDING' },
    { status: 'CANCELLED', cancelledAt: new Date() },
    { new: true },
  );
  if (!booking) {
    const exists = await Booking.exists({ _id: bookingId, userId });
    if (!exists) throw notFound('Booking not found', 'BOOKING_NOT_FOUND');
    throw conflict('This booking is no longer on hold', 'BOOKING_NOT_PENDING');
  }
  await releaseSeats({ eventId: booking.eventId, seatIds: booking.seatIds, ownerId: booking._id });
  emitSeats(booking.eventId, 'seats:released', booking.seatIds);
  await cancelExpiry(booking._id);
  return booking;
}

export async function getBooking(user, bookingId) {
  const booking = await Booking.findById(bookingId)
    .populate('seatIds', 'section row number tier price')
    .populate('eventId', 'title startsAt city');
  if (!booking) throw notFound('Booking not found', 'BOOKING_NOT_FOUND');
  const owner = String(booking.userId) === user.id;
  if (!owner && user.role !== 'admin') throw forbidden('This booking belongs to another user');
  return booking;
}

export async function listMine(userId, { cursor, limit }) {
  const filter = { userId };
  if (cursor) {
    const { i } = decodeCursor(cursor);
    if (!/^[a-f\d]{24}$/i.test(String(i))) throw badRequest('Invalid cursor', undefined, 'INVALID_CURSOR');
    filter._id = { $lt: i };
  }
  const rows = await Booking.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('seatIds', 'section row number tier price')
    .populate('eventId', 'title startsAt city');
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? encodeCursor({ i: String(items.at(-1)._id) }) : null };
}

export const config = { lockTtl: env.SEAT_LOCK_TTL };

// ---- Expiry (called by the worker) ----

/**
 * Marks an unpaid booking expired and frees its seats. Safe to call repeatedly and concurrently:
 * the conditional update means only one caller wins, and the rest are no-ops.
 */
export async function expireBooking(bookingId) {
  const booking = await Booking.findOneAndUpdate(
    // The 2s grace absorbs clock drift between the Redis TTL, the delayed job and this check.
    { _id: bookingId, status: 'PENDING', expiresAt: { $lte: new Date(Date.now() + 2000) } },
    { status: 'EXPIRED' },
    { new: true },
  );
  if (!booking) return false;

  await releaseSeats({ eventId: booking.eventId, seatIds: booking.seatIds, ownerId: booking._id });
  emitSeats(booking.eventId, 'seats:released', booking.seatIds);
  emitToUser(booking.userId, 'booking:expired', { bookingId: String(booking._id) });
  return true;
}

/** Safety net: if a delayed job was lost (Redis flush, deploy), expire anything clearly overdue. */
export async function sweepExpired(limit = 200) {
  const due = await Booking.find({ status: 'PENDING', expiresAt: { $lt: new Date(Date.now() - 5000) } })
    .select('_id')
    .limit(limit)
    .lean();
  let expired = 0;
  for (const { _id } of due) if (await expireBooking(_id)) expired += 1;
  return expired;
}
