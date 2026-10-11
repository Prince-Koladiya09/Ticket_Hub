import { notFound } from '../../common/errors.js';
import { Venue } from './venue.model.js';

export async function createVenue(userId, { sections, ...rest }) {
  return Venue.create({ ...rest, layout: { sections }, createdBy: userId });
}

export function listVenues({ city }) {
  const filter = city ? { city: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } : {};
  return Venue.find(filter).sort({ name: 1 }).limit(100);
}

export async function getVenue(id) {
  const venue = await Venue.findById(id);
  if (!venue) throw notFound('Venue not found', 'VENUE_NOT_FOUND');
  return venue;
}
