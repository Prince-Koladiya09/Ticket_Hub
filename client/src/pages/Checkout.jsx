import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBooking, releaseHold } from '../api/booking.js';
import { ErrorBox, Spinner } from '../components/ui.jsx';
import { formatClock, useCountdown } from '../hooks/useCountdown.js';
import { getSocket } from '../lib/socket.js';
import { formatDate, formatPrice } from '../lib/format.js';

export const route = { path: '/checkout/:bookingId', auth: true };

export default function Checkout() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => fetchBooking(bookingId),
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 15_000 : false),
  });

  const seconds = useCountdown(booking?.status === 'PENDING' ? booking.expiresAt : null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['booking', bookingId] });

  // The server tells us when the hold expires (even if this tab's clock is wrong).
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    const onExpired = (p) => p.bookingId === bookingId && refresh();
    socket.on('booking:expired', onExpired);
    return () => socket.off('booking:expired', onExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // When the local countdown reaches zero, ask the server for the authoritative state.
  useEffect(() => {
    if (booking?.status === 'PENDING' && seconds === 0) {
      const t = setTimeout(refresh, 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, booking?.status]);

  const release = useMutation({
    mutationFn: () => releaseHold(bookingId),
    onSuccess: () => navigate(`/events/${booking.eventId}/seats`),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  const pending = booking.status === 'PENDING' && seconds > 0;
  const urgent = pending && seconds <= 60;

  return (
    <div className="seat-layout">
      <div className="card">
        <h1>Checkout</h1>
        <h3 style={{ marginBottom: 2 }}>{booking.event?.title}</h3>
        <p className="muted">
          {booking.event && formatDate(booking.event.startsAt)} - {booking.event?.city}
        </p>

        {booking.seats.map((s) => (
          <div key={s.id} className="tier-row">
            <span>
              {s.section} - Row {s.row}, Seat {s.number} <span className="muted">({s.tier})</span>
            </span>
            <strong>{formatPrice(s.price)}</strong>
          </div>
        ))}
        <div className="tier-row total">
          <span>Total</span>
          <strong>{formatPrice(booking.totalAmount)}</strong>
        </div>

        {booking.status === 'CONFIRMED' && (
          <div className="success-box">
            Booking confirmed. Your ticket will arrive by email. <Link to="/bookings">View my bookings</Link>
          </div>
        )}
        {['EXPIRED', 'CANCELLED', 'FAILED'].includes(booking.status) && (
          <div className="error-box">
            This hold is {booking.status.toLowerCase()}. <Link to={`/events/${booking.eventId}/seats`}>Pick seats again</Link>
          </div>
        )}
        {booking.status === 'PENDING' && seconds === 0 && <div className="error-box">Your hold has just expired...</div>}
      </div>

      <aside className="card summary">
        {pending ? (
          <>
            <div className={`countdown ${urgent ? 'urgent' : ''}`}>{formatClock(seconds)}</div>
            <p className="muted" style={{ textAlign: 'center', marginTop: 0 }}>
              Your seats are held until the timer ends.
            </p>

            <div className="payment-box">
              <strong>Payment</strong>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Online payment is not enabled yet. This step is where the payment gateway will plug in.
              </p>
            </div>
            <button className="btn" style={{ width: '100%' }} disabled>
              Pay {formatPrice(booking.totalAmount)}
            </button>
            <ErrorBox error={release.error} />
            <button
              className="btn secondary"
              style={{ width: '100%', marginTop: 10 }}
              disabled={release.isPending}
              onClick={() => release.mutate()}
            >
              Release seats
            </button>
          </>
        ) : (
          <>
            <h3>Status</h3>
            <span className={`status status-${booking.status}`}>{booking.status}</span>
          </>
        )}
      </aside>
    </div>
  );
}
