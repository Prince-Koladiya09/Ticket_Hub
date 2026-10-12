import { logger } from '../../common/logger.js';
import { getEvent } from '../events/event.service.js';
import { getSeatsForEvent } from '../seats/seats.service.js';
import { BookedSeat } from './bookedSeat.model.js';
import { Booking } from './booking.model.js';
import { getLocks } from './seatLock.service.js';

/** Seats currently held according to MongoDB (used only if Redis is unreachable). */
async function locksFromDatabase(eventId) {
  const pending = await Booking.find({ eventId, status: 'PENDING', expiresAt: { $gt: new Date() } })
    .select('seatIds')
    .lean();
  const locks = new Map();
  for (const b of pending) for (const s of b.seatIds) locks.set(String(s), String(b._id));
  return locks;
}

/**
 * Builds the live seat map: static layout from MongoDB, overlaid with sold seats (MongoDB)
 * and held seats (Redis). If Redis is down we degrade to PENDING bookings in MongoDB, so the
 * page still works - it just can't see sub-second lock changes.
 */
export async function getSeatMap(eventId, user) {
  const event = await getEvent(eventId, user);
  const seats = await getSeatsForEvent(eventId);
  const seatIds = seats.map((s) => String(s._id));

  const [sold, locks, myHold] = await Promise.all([
    BookedSeat.find({ eventId }).select('seatId').lean(),
    getLocks(eventId, seatIds).catch((err) => {
      logger.warn({ err: err.message }, 'redis unavailable for seat map, falling back to MongoDB');
      return locksFromDatabase(eventId);
    }),
    user
      ? Booking.findOne({ userId: user.id, eventId, status: 'PENDING', expiresAt: { $gt: new Date() } })
          .select('seatIds expiresAt')
          .lean()
      : null,
  ]);

  const soldSet = new Set(sold.map((s) => String(s.seatId)));

  return {
    eventId: String(eventId),
    event: { id: event.id, title: event.title, startsAt: event.startsAt, status: event.status, city: event.city },
    generatedAt: new Date().toISOString(),
    sections: event.venueId.layout.sections.map((s) => ({ name: s.name, rows: s.rows, cols: s.cols, tier: s.tier ?? null })),
    seats: seats.map((s) => {
      const id = String(s._id);
      let status = 'available';
      if (soldSet.has(id)) status = 'booked';
      else if (locks.has(id)) status = 'locked';
      return { id, section: s.section, row: s.row, number: s.number, tier: s.tier, price: s.price, status };
    }),
    myHold: myHold
      ? { bookingId: String(myHold._id), seatIds: myHold.seatIds.map(String), expiresAt: myHold.expiresAt }
      : null,
  };
}
