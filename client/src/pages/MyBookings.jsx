import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelBooking, downloadTicket, fetchMyBookings } from '../api/booking.js';
import { ErrorBox, Spinner } from '../components/ui.jsx';
import { formatDate, formatPrice } from '../lib/format.js';

export const route = { path: '/bookings', auth: true, nav: { label: 'My bookings', order: 10, when: 'auth' } };

export default function MyBookings() {
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['my-bookings'],
    queryFn: ({ pageParam }) => fetchMyBookings({ cursor: pageParam, limit: 10 }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const cancel = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-bookings'] }),
  });
  const download = useMutation({ mutationFn: downloadTicket });

  const bookings = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <h1>My bookings</h1>
      {query.isLoading && <Spinner />}
      {query.error && <ErrorBox error={query.error} />}
      <ErrorBox error={cancel.error || download.error} />
      {!query.isLoading && !bookings.length && (
        <div className="empty">
          You have no bookings yet. <Link to="/">Browse events</Link>
        </div>
      )}

      <div className="stack">
        {bookings.map((b) => (
          <div key={b.id} className="card booking-card">
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3 style={{ marginBottom: 2 }}>{b.event?.title ?? 'Event'}</h3>
              <div className="muted">
                {b.event && formatDate(b.event.startsAt)} - {b.event?.city}
              </div>
              <div style={{ marginTop: 8, fontSize: '0.9rem' }}>
                {b.seats.map((s) => `${s.section} ${s.row}${s.number}`).join(', ')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`status status-${b.status}`}>{b.status}</span>
              <div style={{ margin: '8px 0', fontWeight: 700 }}>{formatPrice(b.totalAmount)}</div>
              <div className="actions">
                {b.status === 'PENDING' && new Date(b.expiresAt) > new Date() && (
                  <Link className="btn small" to={`/checkout/${b.id}`}>
                    Complete booking
                  </Link>
                )}
                {b.status === 'CONFIRMED' && (
                  <>
                    <button className="btn small" disabled={download.isPending} onClick={() => download.mutate(b.id)}>
                      Download ticket
                    </button>
                    <button
                      className="btn secondary small"
                      disabled={cancel.isPending}
                      onClick={() => window.confirm('Cancel this booking?') && cancel.mutate(b.id)}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {query.hasNextPage && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button className="btn secondary" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}
