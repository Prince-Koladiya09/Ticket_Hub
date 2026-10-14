import { notFound } from '../../common/errors.js';
import { BookedSeat } from '../booking/bookedSeat.model.js';
import { Booking } from '../booking/booking.model.js';
import { Event } from '../events/event.model.js';
import { Seat } from '../seats/seat.model.js';
import { Ticket } from '../tickets/ticket.model.js';
import { User } from '../users/user.model.js';

/** Sales, occupancy and attendance for one event (owner or admin only). */
export async function organizerEventStats(user, eventId) {
  const event = await Event.findById(eventId).select('title status totalSeats organizerId startsAt');
  if (!event || (user.role !== 'admin' && String(event.organizerId) !== user.id)) {
    throw notFound('Event not found', 'EVENT_NOT_FOUND');
  }

  const [bookings, sold, activeHolds, confirmedIds] = await Promise.all([
    Booking.countDocuments({ eventId, status: 'CONFIRMED' }),
    BookedSeat.find({ eventId }).select('seatId').lean(),
    Booking.countDocuments({ eventId, status: 'PENDING', expiresAt: { $gt: new Date() } }),
    Booking.find({ eventId, status: 'CONFIRMED' }).distinct('_id'),
  ]);

  // Per-tier breakdown, grouped in memory (bounded by venue capacity, <= 25k seats).
  const soldSeats = sold.length ? await Seat.find({ _id: { $in: sold.map((s) => s.seatId) } }).select('tier price').lean() : [];
  const byTier = new Map();
  for (const s of soldSeats) {
    const row = byTier.get(s.tier) ?? { tier: s.tier, seats: 0, revenue: 0 };
    row.seats += 1;
    row.revenue += s.price;
    byTier.set(s.tier, row);
  }

  const checkedIn = confirmedIds.length ? await Ticket.countDocuments({ bookingId: { $in: confirmedIds }, checkedIn: true }) : 0;
  // Sold-seat rows only exist for confirmed bookings, so their prices add up to the event's revenue.
  const revenue = [...byTier.values()].reduce((sum, t) => sum + t.revenue, 0);

  return {
    event: { id: event.id, title: event.title, status: event.status, startsAt: event.startsAt },
    totalSeats: event.totalSeats,
    soldSeats: sold.length,
    occupancyPct: event.totalSeats ? Math.round((sold.length / event.totalSeats) * 1000) / 10 : 0,
    activeHolds,
    bookings,
    revenue,
    checkedIn,
    byTier: [...byTier.values()].sort((a, b) => b.revenue - a.revenue),
  };
}

/** Platform-wide counters for the admin dashboard. */
export async function platformStats() {
  const [users, events, sales] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { status: 'CONFIRMED' } }, { $group: { _id: null, bookings: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }]),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  return {
    users: toMap(users),
    events: toMap(events),
    confirmedBookings: sales[0]?.bookings ?? 0,
    revenue: sales[0]?.revenue ?? 0,
  };
}
