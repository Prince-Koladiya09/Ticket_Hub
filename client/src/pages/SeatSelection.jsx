import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { holdSeats } from '../api/booking.js';
import SeatMap from '../components/SeatMap.jsx';
import { ErrorBox, Spinner } from '../components/ui.jsx';
import { useSeatMap } from '../hooks/useSeatMap.js';
import { formatDate, formatPrice } from '../lib/format.js';
import { useAuth } from '../store/auth.js';

export const route = { path: '/events/:id/seats' };

const MAX_SEATS = 6;

export default function SeatSelection() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const { data: map, isLoading, error } = useSeatMap(id);
  const [selected, setSelected] = useState(new Map());

  const hold = useMutation({
    mutationFn: () => holdSeats(id, [...selected.keys()]),
    onSuccess: (data) => navigate(`/checkout/${data.bookingId}`),
    onError: (err) => {
      // Someone else grabbed a seat first: drop it from the selection and refresh the map.
      const conflicts = err.details?.conflicts;
      if (conflicts) {
        setSelected((prev) => new Map([...prev].filter(([seatId]) => !conflicts.includes(seatId))));
      }
      qc.invalidateQueries({ queryKey: ['seatmap', id] });
    },
  });

  if (isLoading) return <Spinner label="Loading seat map..." />;
  if (error) return <ErrorBox error={error} />;

  const mine = new Set(map.myHold?.seatIds ?? []);
  const total = [...selected.values()].reduce((sum, s) => sum + s.price, 0);

  const toggle = (seat) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else if (next.size < MAX_SEATS) next.set(seat.id, seat);
      return next;
    });

  // A seat someone else just took must not stay "selected" locally.
  const selectedIds = new Set([...selected.keys()].filter((sid) => map.seats.find((s) => s.id === sid)?.status === 'available'));

  return (
    <div className="seat-layout">
      <div>
        <Link to={`/events/${id}`}>&larr; Back to event</Link>
        <h1 style={{ marginTop: 8 }}>{map.event.title}</h1>
        <p className="muted">
          {formatDate(map.event.startsAt)} - {map.event.city}
        </p>
        {map.myHold && (
          <div className="success-box">
            You have seats on hold. <Link to={`/checkout/${map.myHold.bookingId}`}>Continue to checkout</Link>
          </div>
        )}
        <SeatMap
          seats={map.seats}
          sections={map.sections}
          selected={selectedIds}
          mine={mine}
          onToggle={toggle}
          disabled={!!map.myHold}
        />
      </div>

      <aside className="card summary">
        <h3>Your selection</h3>
        {selectedIds.size === 0 && <p className="muted">Pick up to {MAX_SEATS} seats.</p>}
        {[...selectedIds].map((sid) => {
          const s = selected.get(sid);
          return (
            <div key={sid} className="tier-row">
              <span>
                {s.section} {s.row}
                {s.number}
              </span>
              <strong>{formatPrice(s.price)}</strong>
            </div>
          );
        })}
        {selectedIds.size > 0 && (
          <div className="tier-row total">
            <span>Total</span>
            <strong>{formatPrice([...selectedIds].reduce((sum, sid) => sum + selected.get(sid).price, 0))}</strong>
          </div>
        )}
        <ErrorBox error={hold.error} />
        {user ? (
          <button
            className="btn"
            style={{ width: '100%', marginTop: 14 }}
            disabled={!selectedIds.size || hold.isPending || !!map.myHold}
            onClick={() => hold.mutate()}
          >
            {hold.isPending ? 'Holding seats...' : `Hold seats${total ? ` - ${formatPrice(total)}` : ''}`}
          </button>
        ) : (
          <Link to="/login" state={{ from: `/events/${id}/seats` }} className="btn" style={{ width: '100%', marginTop: 14 }}>
            Log in to book
          </Link>
        )}
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
          Seats are held for a few minutes while you check out.
        </p>
      </aside>
    </div>
  );
}
