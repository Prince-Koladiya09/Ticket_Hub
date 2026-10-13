import mongoose from 'mongoose';
import { baseOptions } from '../../common/schemaOptions.js';

const ticketSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    // Opaque random token encoded in the QR. It carries no data itself; the server looks it up.
    qrToken: { type: String, required: true, unique: true },
    pdfPath: String,
    checkedIn: { type: Boolean, default: false },
    checkedInAt: Date,
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  baseOptions,
);

export const Ticket = mongoose.model('Ticket', ticketSchema);
