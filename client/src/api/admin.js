import { get, post, patch } from './http.js';

export const fetchPending = () => get('/admin/events/pending').then((r) => r.data);
export const approveEvent = (id) => post(`/admin/events/${id}/approve`).then((r) => r.data);
export const rejectEvent = (id, reason) => post(`/admin/events/${id}/reject`, { reason }).then((r) => r.data);
export const suspendUser = (id, suspended) => patch(`/admin/users/${id}/suspend`, { suspended }).then((r) => r.data);
