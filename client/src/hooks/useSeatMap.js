import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSeatMap } from '../api/booking.js';
import { getSocket } from '../lib/socket.js';
import { useAuth } from '../store/auth.js';

const applyStatus = (map, seatIds, status) => {
  const ids = new Set(seatIds);
  return { ...map, seats: map.seats.map((s) => (ids.has(s.id) ? { ...s, status } : s)) };
};

/**
 * Seat map query + live updates. The initial state comes from REST; after that the server pushes
 * deltas over the socket. After a reconnect we refetch, because events may have been missed.
 */
export function useSeatMap(eventId) {
  const qc = useQueryClient();
  const userId = useAuth((s) => s.user?.id);
  const key = ['seatmap', eventId, userId ?? 'anon'];

  const query = useQuery({ queryKey: key, queryFn: () => fetchSeatMap(eventId), staleTime: 0 });
  const connectedBefore = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    const patch = (status) => ({ eventId: id, seatIds }) => {
      if (id !== eventId) return;
      qc.setQueryData(key, (old) => (old ? applyStatus(old, seatIds, status) : old));
    };
    const onLocked = patch('locked');
    const onReleased = patch('available');
    const onBooked = patch('booked');

    const onConnect = () => {
      socket.emit('event:join', { eventId });
      if (connectedBefore.current) qc.invalidateQueries({ queryKey: key });
      connectedBefore.current = true;
    };

    socket.on('connect', onConnect);
    socket.on('seats:locked', onLocked);
    socket.on('seats:released', onReleased);
    socket.on('seats:booked', onBooked);
    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.emit('event:leave', { eventId });
      socket.off('connect', onConnect);
      socket.off('seats:locked', onLocked);
      socket.off('seats:released', onReleased);
      socket.off('seats:booked', onBooked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, userId]);

  return query;
}
