import { Emitter } from '@socket.io/redis-emitter';
import { redis } from '../config/redis.js';
import { logger } from './logger.js';

/**
 * Broadcasting without owning a Socket.IO server.
 *
 * The API processes run Socket.IO with the Redis adapter, which subscribes to a Redis channel.
 * This emitter publishes to that same channel, so ANY process (an API instance or a background
 * worker that expires a hold) can push an event to every connected client on every instance.
 */
const publisher = {
  // Realtime is best-effort: a Redis hiccup must never break a booking, so errors are logged and swallowed.
  publish: (channel, message) =>
    redis.publish(channel, message).catch((err) => logger.warn({ err: err.message }, 'realtime publish failed')),
};
const emitter = new Emitter(publisher);

export const eventRoom = (eventId) => `event:${eventId}`;
export const userRoom = (userId) => `user:${userId}`;

/** type: 'seats:locked' | 'seats:released' | 'seats:booked' */
export function emitSeats(eventId, type, seatIds) {
  if (!seatIds?.length) return;
  emitter.to(eventRoom(eventId)).emit(type, { eventId: String(eventId), seatIds: seatIds.map(String) });
}

export function emitToUser(userId, type, payload) {
  emitter.to(userRoom(userId)).emit(type, payload);
}
