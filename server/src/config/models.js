/**
 * Registers every Mongoose model. The API loads models implicitly through its routes, but a
 * standalone process (the worker, seed scripts) must import this so populate() can resolve refs.
 */
import '../modules/users/user.model.js';
import '../modules/auth/refreshToken.model.js';
import '../modules/venues/venue.model.js';
import '../modules/events/event.model.js';
import '../modules/seats/seat.model.js';
import '../modules/booking/booking.model.js';
import '../modules/booking/bookedSeat.model.js';
import '../modules/tickets/ticket.model.js';
