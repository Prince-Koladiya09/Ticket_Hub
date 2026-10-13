import { env } from '../../config/env.js';

// User-controlled text (names, event titles) is escaped before it goes into HTML.
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const when = (d) =>
  new Date(d).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

const layout = (title, body) => `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1b1e2e">
  <div style="background:#14172b;color:#fff;padding:18px 24px;font-size:20px;font-weight:700">Ticket<span style="color:#a99dff">Hub</span></div>
  <div style="padding:24px;border:1px solid #e4e6ef;border-top:0">
    <h2 style="margin-top:0">${esc(title)}</h2>
    ${body}
  </div>
</div>`;

const seatList = (seats) =>
  `<ul>${seats.map((s) => `<li>${esc(s.section)} - Row ${esc(s.row)}, Seat ${esc(s.number)} (${esc(s.tier)})</li>`).join('')}</ul>`;

export const templates = {
  verifyEmail: ({ name, token }) => {
    const link = `${env.CLIENT_URL.split(',')[0]}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`;
    return {
      subject: 'Verify your TicketHub email',
      html: layout(
        `Welcome, ${name}!`,
        `<p>Please confirm your email address to finish setting up your account.</p>
         <p><a href="${esc(link)}" style="background:#6c5ce7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify email</a></p>`,
      ),
    };
  },

  bookingConfirmed: ({ name, eventTitle, startsAt, venue, seats, totalAmount, bookingId }) => ({
    subject: `Your tickets for ${eventTitle}`,
    html: layout(
      'Booking confirmed',
      `<p>Hi ${esc(name)}, you're going to <strong>${esc(eventTitle)}</strong>!</p>
       <p>${esc(when(startsAt))}<br>${esc(venue)}</p>
       ${seatList(seats)}
       <p>Total paid: <strong>${money(totalAmount)}</strong></p>
       <p style="color:#6b7185;font-size:13px">Your ticket PDF is attached. Show the QR code at the entrance. Booking ref: ${esc(bookingId)}</p>`,
    ),
  }),

  bookingCancelled: ({ name, eventTitle, totalAmount, bookingId }) => ({
    subject: `Booking cancelled: ${eventTitle}`,
    html: layout(
      'Booking cancelled',
      `<p>Hi ${esc(name)}, your booking for <strong>${esc(eventTitle)}</strong> has been cancelled and the seats were released.</p>
       <p>Amount: ${money(totalAmount)}. Any refund will be handled once online payments are enabled.</p>
       <p style="color:#6b7185;font-size:13px">Booking ref: ${esc(bookingId)}</p>`,
    ),
  }),
};
