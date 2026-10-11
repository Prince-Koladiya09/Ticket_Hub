import mongoose from 'mongoose';

const seatSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  section: { type: String, required: true },
  row: { type: String, required: true },
  number: { type: Number, required: true },
  tier: { type: String, required: true },
  price: { type: Number, required: true },
});

seatSchema.index({ eventId: 1, section: 1, row: 1, number: 1 }, { unique: true });
seatSchema.set('toJSON', {
  versionKey: false,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const Seat = mongoose.model('Seat', seatSchema);
