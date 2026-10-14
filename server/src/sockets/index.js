import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../config/env.js';
import { createRedis } from '../config/redis.js';
import { logger } from '../common/logger.js';
import { activeSockets } from '../common/metrics.js';
import { eventRoom, userRoom } from '../common/realtime.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

export function initSockets(httpServer) {
  // WebSocket-only: no HTTP long-polling means no sticky sessions are needed behind a load balancer.
  const io = new Server(httpServer, {
    transports: ['websocket'],
    cors: { origin: env.CLIENT_URL.split(','), credentials: true },
  });

  const pub = createRedis();
  io.adapter(createAdapter(pub, pub.duplicate()));

  // Viewing a seat map is public, so the token is optional. A valid one additionally joins the
  // user's private room (used for "your hold expired"). The token is read at handshake time,
  // so clients reconnect with a fresh one after a token refresh.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
        socket.data.user = { id: payload.sub, role: payload.role };
      } catch {
        /* anonymous */
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    activeSockets.inc();
    socket.on('disconnect', () => activeSockets.dec());
    if (socket.data.user) socket.join(userRoom(socket.data.user.id));

    socket.on('event:join', (payload, ack) => {
      const eventId = payload?.eventId;
      if (!OBJECT_ID.test(String(eventId))) return ack?.({ ok: false });
      socket.join(eventRoom(eventId));
      ack?.({ ok: true });
    });

    socket.on('event:leave', (payload) => {
      if (OBJECT_ID.test(String(payload?.eventId))) socket.leave(eventRoom(payload.eventId));
    });
  });

  logger.info('Socket.IO ready (redis adapter)');
  return io;
}
