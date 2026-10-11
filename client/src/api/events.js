import { get, post, patch, del } from './http.js';

export const fetchEvents = (params) =>
  get('/events', params).then((r) => ({ items: r.data, nextCursor: r.meta?.nextCursor ?? null }));

export const fetchEvent = (id) => get(`/events/${id}`).then((r) => r.data);
export const fetchMyEvents = () => get('/events/mine').then((r) => r.data);
export const createEvent = (body) => post('/events', body).then((r) => r.data);
export const updateEvent = (id, body) => patch(`/events/${id}`, body).then((r) => r.data);
export const submitEvent = (id) => post(`/events/${id}/submit`).then((r) => r.data);
export const cancelEvent = (id) => del(`/events/${id}`).then((r) => r.data);

export const fetchVenues = () => get('/venues').then((r) => r.data);
export const createVenue = (body) => post('/venues', body).then((r) => r.data);
