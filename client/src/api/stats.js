import { get } from './http.js';

export const fetchEventStats = (id) => get(`/organizer/events/${id}/stats`).then((r) => r.data);
export const fetchPlatformStats = () => get('/admin/stats').then((r) => r.data);
