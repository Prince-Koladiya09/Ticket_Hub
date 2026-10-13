import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
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

// ---- Reading and scanning tickets ----

async function getOwnedTicket(user, bookingId) {
  const ctx = await loadBookingContext(bookingId);
  const isOwner = String(ctx.userId._id) === user.id;
  if (!isOwner && user.role !== 'admin') throw forbidden('This ticket belongs to another user');
  if (ctx.status !== 'CONFIRMED') throw conflict('This booking has no active ticket', 'NO_ACTIVE_TICKET');
  const ticket = await Ticket.findOne({ bookingId });
  // The ticket is produced asynchronously, so it can legitimately be missing for a few seconds.
  if (!ticket) throw notFound('Your ticket is still being generated, try again shortly', 'TICKET_NOT_READY');
  return { ticket, ctx };
}

export async function getTicket(user, bookingId) {
  const { ticket, ctx } = await getOwnedTicket(user, bookingId);
  return {
    id: ticket.id,
    bookingId: String(ctx._id),
    checkedIn: ticket.checkedIn,
    qrDataUrl: await QRCode.toDataURL(ticket.qrToken, { width: 280, margin: 1 }),
    event: { title: ctx.eventId.title, startsAt: ctx.eventId.startsAt },
    seats: ctx.seatIds.map((s) => ({ section: s.section, row: s.row, number: s.number })),
  };
}

export async function getTicketPdfPath(user, bookingId) {
  const { ticket } = await getOwnedTicket(user, bookingId);
  if (!ticket.pdfPath) throw notFound('Ticket PDF is not ready yet', 'TICKET_NOT_READY');
  return ticket.pdfPath;
}

/**
 * Entry scan. The organizer of the event (or an admin) submits the token read from the QR code.
 * The final update is conditional on checkedIn:false, so two scanners reading the same ticket
 * at the same moment cannot both be told "valid".
 */
export async function checkIn(user, qrToken) {
  const ticket = await Ticket.findOne({ qrToken });
  if (!ticket) throw notFound('Unknown ticket', 'TICKET_NOT_FOUND');

  const ctx = await loadBookingContext(ticket.bookingId);
  if (user.role !== 'admin' && String(ctx.eventId.organizerId) !== user.id) {
    throw forbidden('This ticket is for an event you do not organize');
  }
  if (ctx.status !== 'CONFIRMED') throw conflict('This booking is no longer valid', 'BOOKING_NOT_ACTIVE');

  const updated = await Ticket.findOneAndUpdate(
    { _id: ticket._id, checkedIn: false },
    { checkedIn: true, checkedInAt: new Date(), checkedInBy: user.id },
    { new: true },
  );
  if (!updated) {
    throw conflict('This ticket has already been used', 'ALREADY_CHECKED_IN', { checkedInAt: ticket.checkedInAt });
  }
  return {
    valid: true,
    event: ctx.eventId.title,
    holder: ctx.userId.name,
    seats: ctx.seatIds.map((s) => `${s.section} ${s.row}${s.number}`),
    checkedInAt: updated.checkedInAt,
  };
}
