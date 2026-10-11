import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchEvent } from '../api/events.js';
import { ErrorBox, Spinner } from '../components/ui.jsx';
import { formatDate, formatPrice, titleCase } from '../lib/format.js';

export const route = { path: '/events/:id' };

export default function EventDetail() {
  const { id } = useParams();
  const { data: event, isLoading, error } = useQuery({ queryKey: ['event', id], queryFn: () => fetchEvent(id) });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  const bookable = event.status === 'published';

  return (
    <div className="detail">
      <div>
        <span className="chip-inline">{titleCase(event.category)}</span>
        <h1>{event.title}</h1>
        <p className="muted">
          {formatDate(event.startsAt)} - {event.venue?.name}, {event.city}
        </p>
        {event.venue?.address && <p className="muted">{event.venue.address}</p>}
        <div className="card" style={{ marginTop: 20 }}>
          <h3>About this event</h3>
          <p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{event.description || 'No description provided.'}</p>
        </div>
      </div>

      <aside className="card">
        <h3>Tickets</h3>
        {event.pricingTiers.map((t) => (
          <div key={t.name} className="tier-row">
            <span>{t.name}</span>
            <strong>{formatPrice(t.price)}</strong>
          </div>
        ))}
        {bookable ? (
          <Link to={`/events/${event.id}/seats`} className="btn" style={{ width: '100%', marginTop: 16 }}>
            Select seats
          </Link>
        ) : (
          <div className="error-box">This event is {event.status.replace('_', ' ')} and not open for booking.</div>
        )}
        {event.status === 'rejected' && event.rejectionReason && (
          <p className="muted">Reason: {event.rejectionReason}</p>
        )}
      </aside>
    </div>
  );
}
