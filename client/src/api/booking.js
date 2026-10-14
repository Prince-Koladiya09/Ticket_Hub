import { get, http, post, del } from './http.js';

export const fetchSeatMap = (eventId) => get(`/events/${eventId}/seats`).then((r) => r.data);
export const holdSeats = (eventId, seatIds) => post('/bookings/hold', { eventId, seatIds }).then((r) => r.data);
export const fetchBooking = (id) => get(`/bookings/${id}`).then((r) => r.data);
export const releaseHold = (id) => del(`/bookings/${id}/hold`).then((r) => r.data);
export const fetchMyBookings = (params) =>
  get('/bookings/me', params).then((r) => ({ items: r.data, nextCursor: r.meta?.nextCursor ?? null }));

// Dev/demo only: stands in for the payment webhook until payments are integrated.
export const devConfirm = (id) => post(`/bookings/${id}/dev-confirm`).then((r) => r.data);

export const cancelBooking = (id) => post(`/bookings/${id}/cancel`).then((r) => r.data);

/** The PDF endpoint needs the bearer token, so fetch it as a blob and hand it to the browser. */
export async function downloadTicket(bookingId) {
  const res = await http.get(`/tickets/${bookingId}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ticket-${bookingId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
