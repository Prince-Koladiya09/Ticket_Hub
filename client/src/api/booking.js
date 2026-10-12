import { get, post, del } from './http.js';

export const fetchSeatMap = (eventId) => get(`/events/${eventId}/seats`).then((r) => r.data);
export const holdSeats = (eventId, seatIds) => post('/bookings/hold', { eventId, seatIds }).then((r) => r.data);
export const fetchBooking = (id) => get(`/bookings/${id}`).then((r) => r.data);
export const releaseHold = (id) => del(`/bookings/${id}/hold`).then((r) => r.data);
export const fetchMyBookings = (params) =>
  get('/bookings/me', params).then((r) => ({ items: r.data, nextCursor: r.meta?.nextCursor ?? null }));
