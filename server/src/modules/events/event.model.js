import mongoose from 'mongoose';
import { baseOptions } from '../../common/schemaOptions.js';

export const EVENT_STATUS = ['draft', 'pending_approval', 'published', 'rejected', 'completed', 'cancelled'];
export const CATEGORIES = ['concert', 'sports', 'theatre', 'comedy', 'conference', 'festival', 'other'];

const tierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    price: { type: Number, required: true, min: 0 }, // whole rupees
  },
  { _id: false },
);

/**
 * Lifecycle: draft -> pending_approval -> published -> completed
 *                 ^         |--> rejected (organizer can edit and resubmit)
 *            any pre-completed state -> cancelled
 */
const eventSchema = new mongoose.Schema(
  {
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    category: { type: String, enum: CATEGORIES, default: 'other' },
    city: { type: String, required: true, trim: true },
    cityKey: { type: String, index: false }, // lowercase city for case-insensitive filtering
    bannerUrl: { type: String, trim: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date },
    status: { type: String, enum: EVENT_STATUS, default: 'draft' },
    rejectionReason: { type: String, trim: true },
    pricingTiers: {
      type: [tierSchema],
      validate: [(v) => v.length >= 1 && v.length <= 8, 'Between 1 and 8 pricing tiers are required'],
    },
    // Denormalized for fast filtering and listing cards.
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    totalSeats: { type: Number, default: 0 },
  },
  baseOptions,
);

eventSchema.pre('validate', function derive(next) {
  if (this.city) this.cityKey = this.city.trim().toLowerCase();
  if (this.pricingTiers?.length) {
    const prices = this.pricingTiers.map((t) => t.price);
    this.minPrice = Math.min(...prices);
    this.maxPrice = Math.max(...prices);
  }
  next();
});

// Full-text search with title weighted highest.
eventSchema.index(
  { title: 'text', description: 'text', city: 'text' },
  { weights: { title: 10, city: 4, description: 1 }, name: 'event_text' },
);
// Listing / cursor pagination: equality fields first, then the sort key (startsAt, _id).
eventSchema.index({ status: 1, startsAt: 1, _id: 1 });
eventSchema.index({ status: 1, cityKey: 1, startsAt: 1 });
eventSchema.index({ status: 1, category: 1, startsAt: 1 });
eventSchema.index({ organizerId: 1, createdAt: -1 });

export const Event = mongoose.model('Event', eventSchema);
