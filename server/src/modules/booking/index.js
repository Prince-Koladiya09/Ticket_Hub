import { bookingRouter } from './booking.routes.js';
import { seatMapRouter } from './seatmap.routes.js';

export const routes = [
  { path: '/bookings', router: bookingRouter },
  { path: '/events', router: seatMapRouter },
];
