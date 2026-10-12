import { io } from 'socket.io-client';
import { useAuth } from '../store/auth.js';

let socket;

/**
 * One shared socket for the whole app.
 * websocket-only (no long-polling) so it works behind a round-robin load balancer without sticky sessions.
 * The auth token is read on every (re)connect via a callback, so it is always fresh.
 */
export function getSocket() {
  if (!socket) {
    socket = io({
      transports: ['websocket'],
      autoConnect: false,
      auth: (cb) => cb({ token: useAuth.getState().accessToken }),
    });

    // When the user logs in/out, reconnect so the server puts the socket in the right private room.
    useAuth.subscribe((state, prev) => {
      if (state.user?.id !== prev.user?.id && socket.connected) {
        socket.disconnect();
        socket.connect();
      }
    });
  }
  return socket;
}
