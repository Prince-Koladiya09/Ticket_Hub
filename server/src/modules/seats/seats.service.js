import { cacheAside, invalidate } from '../../common/cache.js';
import { Seat } from './seat.model.js';
import { buildSeats } from './seatGenerator.js';

/** Replaces all seats of an event (only valid while the event has no bookings, i.e. in draft). */
export async function replaceSeatsForEvent(event, venue) {
  const seats = buildSeats({
    eventId: event._id,
    sections: venue.layout.sections,
    pricingTiers: event.pricingTiers,
  });
  await Seat.deleteMany({ eventId: event._id });
  await Seat.insertMany(seats, { ordered: false });
  await invalidate(layoutKey(event._id));
  return seats.length;
}

const layoutKey = (eventId) => `cache:seats:layout:${eventId}`;

export async function deleteSeatsForEvent(eventId) {
  await Seat.deleteMany({ eventId });
  await invalidate(layoutKey(eventId));
}

export const getSeatsByIds = (eventId, seatIds) =>
  Seat.find({ _id: { $in: seatIds }, eventId }).lean();

/** The seat layout is static once an event exists, so it is cached for an hour. */
export const getSeatsForEvent = (eventId) =>
  cacheAside(layoutKey(eventId), 3600, () => Seat.find({ eventId }).sort({ section: 1, row: 1, number: 1 }).lean());
