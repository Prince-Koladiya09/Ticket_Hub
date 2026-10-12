import { badRequest, conflict, notFound } from '../../common/errors.js';
import { decodeCursor, encodeCursor } from '../../common/cursor.js';
import { getVenue } from '../venues/venues.service.js';
import { deleteSeatsForEvent, replaceSeatsForEvent } from '../seats/seats.service.js';
import { Event } from './event.model.js';

const STRUCTURAL_EDIT_STATES = ['draft', 'rejected'];
const PUBLISHED_EDITABLE_FIELDS = ['title', 'description', 'bannerUrl'];

/** Event + populated venue as a plain DTO with `venue` and `venueId` separated. */
export function toDto(event) {
  const o = event.toJSON();
  if (o.venueId && typeof o.venueId === 'object') {
    o.venue = o.venueId;
    o.venueId = o.venue.id;
  }
  return o;
}

const populateVenue = (q) => q.populate('venueId', 'name city address layout');

function assertTiersMatchVenue(venue, tiers) {
  const names = new Set(tiers.map((t) => t.name.toLowerCase()));
  for (const s of venue.layout.sections) {
    if (s.tier && !names.has(s.tier.toLowerCase())) {
      throw badRequest(
        `Venue section "${s.name}" uses tier "${s.tier}" which is missing from the pricing tiers`,
        undefined,
        'TIER_MISMATCH',
      );
    }
  }
}

const isOwnerOrAdmin = (user, event) =>
  !!user && (user.role === 'admin' || String(event.organizerId) === user.id);

async function loadManaged(user, id) {
  const event = await Event.findById(id);
  // Not the owner? Pretend it doesn't exist rather than leaking its existence.
  if (!event || !isOwnerOrAdmin(user, event)) throw notFound('Event not found', 'EVENT_NOT_FOUND');
  return event;
}

export async function createEvent(user, input) {
  const venue = await getVenue(input.venueId);
  assertTiersMatchVenue(venue, input.pricingTiers);

  const event = await Event.create({
    ...input,
    bannerUrl: input.bannerUrl || undefined,
    organizerId: user.id,
    city: venue.city,
    status: 'draft',
  });

  try {
    event.totalSeats = await replaceSeatsForEvent(event, venue);
    await event.save();
  } catch (err) {
    // Don't leave a half-created event behind.
    await Promise.all([Event.deleteOne({ _id: event._id }), deleteSeatsForEvent(event._id)]);
    throw err;
  }
  return event;
}

export async function updateEvent(user, id, patch) {
  const event = await loadManaged(user, id);

  if (['completed', 'cancelled'].includes(event.status)) {
    throw conflict(`A ${event.status} event can no longer be edited`, 'EVENT_LOCKED');
  }
  if (event.status === 'published') {
    const blocked = Object.keys(patch).filter((k) => !PUBLISHED_EDITABLE_FIELDS.includes(k));
    if (blocked.length) {
      throw conflict(
        `Published events only allow editing ${PUBLISHED_EDITABLE_FIELDS.join(', ')}`,
        'EVENT_LOCKED',
        { blocked },
      );
    }
  }

  const structural = patch.venueId !== undefined || patch.pricingTiers !== undefined;
  if (structural && !STRUCTURAL_EDIT_STATES.includes(event.status)) {
    throw conflict('Venue and pricing can only change while the event is a draft', 'EVENT_LOCKED');
  }

  event.set({ ...patch, bannerUrl: patch.bannerUrl === '' ? undefined : patch.bannerUrl ?? event.bannerUrl });

  if (structural) {
    const venue = await getVenue(event.venueId);
    assertTiersMatchVenue(venue, event.pricingTiers);
    event.city = venue.city;
    event.totalSeats = await replaceSeatsForEvent(event, venue);
  }
  if (event.endsAt && event.endsAt <= event.startsAt) {
    throw badRequest('endsAt must be after startsAt', undefined, 'INVALID_DATES');
  }
  await event.save();
  return event;
}

export async function submitEvent(user, id) {
  const event = await loadManaged(user, id);
  if (!STRUCTURAL_EDIT_STATES.includes(event.status)) {
    throw conflict(`Only draft or rejected events can be submitted (current: ${event.status})`, 'INVALID_STATE');
  }
  if (event.startsAt <= new Date()) throw badRequest('Event start time is in the past', undefined, 'INVALID_DATES');
  if (!event.totalSeats) throw badRequest('Event has no seats', undefined, 'NO_SEATS');
  event.status = 'pending_approval';
  event.rejectionReason = undefined;
  await event.save();
  return event;
}

export async function cancelEvent(user, id) {
  const event = await loadManaged(user, id);
  if (['completed', 'cancelled'].includes(event.status)) {
    throw conflict(`Event is already ${event.status}`, 'INVALID_STATE');
  }
  event.status = 'cancelled';
  await event.save();
  return event;
}

/** Public view for published events; owners and admins can also see their non-public events. */
export async function getEvent(id, user) {
  const event = await populateVenue(Event.findById(id));
  const visible = event && (event.status === 'published' || isOwnerOrAdmin(user, event));
  if (!visible) throw notFound('Event not found', 'EVENT_NOT_FOUND');
  return event;
}

export const listMine = (userId) =>
  populateVenue(Event.find({ organizerId: userId }).sort({ createdAt: -1 }).limit(200));

// ---- Moderation (used by the admin module) ----

export const listPending = () =>
  populateVenue(Event.find({ status: 'pending_approval' }).sort({ createdAt: 1 }).limit(200));

export async function approveEvent(id) {
  const event = await Event.findOneAndUpdate(
    { _id: id, status: 'pending_approval' },
    { status: 'published', rejectionReason: undefined },
    { new: true },
  );
  if (!event) throw conflict('Event is not awaiting approval', 'INVALID_STATE');
  return event;
}

export async function rejectEvent(id, reason) {
  const event = await Event.findOneAndUpdate(
    { _id: id, status: 'pending_approval' },
    { status: 'rejected', rejectionReason: reason },
    { new: true },
  );
  if (!event) throw conflict('Event is not awaiting approval', 'INVALID_STATE');
  return event;
}

// ---- Public discovery ----

/**
 * Search and filter published events with keyset (cursor) pagination.
 * Sort key is (startsAt, _id): startsAt gives chronological order and _id breaks ties,
 * so the order is total and stable. This matches the { status, startsAt, _id } index.
 */
export async function listPublished({ q, city, category, from, to, minPrice, maxPrice, cursor, limit }) {
  const clauses = [{ status: 'published' }];

  const startsAt = { $gte: from ?? new Date() };
  if (to) startsAt.$lte = to;
  clauses.push({ startsAt });

  if (q) clauses.push({ $text: { $search: q } });
  if (city) clauses.push({ cityKey: city.trim().toLowerCase() });
  if (category) clauses.push({ category });
  // An event matches a price range if any of its tiers can fall inside it.
  if (minPrice != null) clauses.push({ maxPrice: { $gte: minPrice } });
  if (maxPrice != null) clauses.push({ minPrice: { $lte: maxPrice } });

  if (cursor) {
    const { s, i } = decodeCursor(cursor);
    const after = new Date(s);
    if (Number.isNaN(after.getTime()) || !/^[a-f\d]{24}$/i.test(String(i))) {
      throw badRequest('Invalid cursor', undefined, 'INVALID_CURSOR');
    }
    clauses.push({ $or: [{ startsAt: { $gt: after } }, { startsAt: after, _id: { $gt: i } }] });
  }

  // Fetch one extra row to know whether another page exists without a count query.
  const rows = await Event.find({ $and: clauses })
    .sort({ startsAt: 1, _id: 1 })
    .limit(limit + 1)
    .select('-description')
    .lean({ virtuals: false });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasMore ? encodeCursor({ s: last.startsAt.toISOString(), i: String(last._id) }) : null;

  return {
    items: items.map(({ _id, __v, ...rest }) => ({ id: String(_id), ...rest })),
    nextCursor,
  };
}

// ---- Used by the booking module ----

/** Returns the event if seats can currently be held for it, otherwise throws. */
export async function assertBookable(eventId) {
  const event = await Event.findById(eventId).select('status startsAt title city');
  if (!event) throw notFound('Event not found', 'EVENT_NOT_FOUND');
  if (event.status !== 'published') throw conflict('This event is not open for booking', 'EVENT_NOT_BOOKABLE');
  if (event.startsAt <= new Date()) throw conflict('This event has already started', 'EVENT_STARTED');
  return event;
}
