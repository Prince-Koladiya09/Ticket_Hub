import mongoose from 'mongoose';
import { baseOptions } from '../../common/schemaOptions.js';

// A section is a rows x cols grid of seats that belongs to one pricing tier.
const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    rows: { type: Number, required: true, min: 1, max: 50 },
    cols: { type: Number, required: true, min: 1, max: 50 },
    tier: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false },
);

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, trim: true, maxlength: 200 },
    layout: {
      sections: {
        type: [sectionSchema],
        validate: [(v) => v.length >= 1 && v.length <= 10, 'A venue needs between 1 and 10 sections'],
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseOptions,
);

venueSchema.index({ city: 1 });
venueSchema.virtual('capacity').get(function capacity() {
  return this.layout.sections.reduce((sum, s) => sum + s.rows * s.cols, 0);
});
venueSchema.set('toJSON', { ...baseOptions.toJSON, virtuals: true });

export const Venue = mongoose.model('Venue', venueSchema);
