import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { loadBookingContext } from '../booking/booking.service.js';
import { enqueueEmail } from '../notifications/email.service.js';
import { Ticket } from './ticket.model.js';
import { renderTicketPdf } from './ticketPdf.js';

const pdfPathFor = (bookingId) => path.resolve(env.STORAGE_DIR, 'tickets', `${bookingId}.pdf`);

/**
 * Creates (or finds) the ticket for a confirmed booking and renders its PDF.
 * Idempotent: the upsert on the unique bookingId means a retried job reuses the same QR token,
 * and the PDF is only re-rendered if the file is missing.
 */
export async function generateTicket(bookingId) {
  const ctx = await loadBookingContext(bookingId);
  if (ctx.status !== 'CONFIRMED') return null;

  const ticket = await Ticket.findOneAndUpdate(
    { bookingId },
    { $setOnInsert: { bookingId, qrToken: crypto.randomBytes(24).toString('base64url') } },
    { upsert: true, new: true },
  );

  const filePath = pdfPathFor(bookingId);
  const exists = await fs.access(filePath).then(() => true, () => false);
  if (!exists) {
    const qrPng = await QRCode.toBuffer(ticket.qrToken, { width: 320, margin: 1 });
    await renderTicketPdf({
      filePath,
      qrPng,
      event: ctx.eventId,
      venue: ctx.eventId.venueId,
      seats: ctx.seatIds,
      booking: ctx,
      holder: ctx.userId,
    });
  }
  if (ticket.pdfPath !== filePath) {
    ticket.pdfPath = filePath;
    await ticket.save();
  }
  return { ticket, ctx, filePath };
}

/** Worker entrypoint: build the ticket, then email it as an attachment. */
export async function generateTicketAndNotify(bookingId) {
  const result = await generateTicket(bookingId);
  if (!result) return { skipped: true };
  const { ctx, filePath } = result;
  await enqueueEmail(
    'bookingConfirmed',
    ctx.userId.email,
    {
      name: ctx.userId.name,
      eventTitle: ctx.eventId.title,
      startsAt: ctx.eventId.startsAt,
      venue: ctx.eventId.venueId?.name,
      seats: ctx.seatIds.map((s) => s.toJSON()),
      totalAmount: ctx.totalAmount,
      bookingId: String(ctx._id),
    },
    [{ filename: 'ticket.pdf', path: filePath }],
  );
  return { ticketId: String(result.ticket._id) };
}
