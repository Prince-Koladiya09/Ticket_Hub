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
  return seats.length;
}

export const deleteSeatsForEvent = (eventId) => Seat.deleteMany({ eventId });

export const getSeatsByIds = (eventId, seatIds) =>
  Seat.find({ _id: { $in: seatIds }, eventId }).lean();

export const getSeatsForEvent = (eventId) =>
  Seat.find({ eventId }).sort({ section: 1, row: 1, number: 1 }).lean();
