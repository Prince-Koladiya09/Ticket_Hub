import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelEvent, fetchMyEvents, submitEvent } from '../api/events.js';
import EventForm from '../components/EventForm.jsx';
import VenueForm from '../components/VenueForm.jsx';
import { ErrorBox, Spinner } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

export const route = {
  path: '/organizer',
  roles: ['organizer', 'admin'],
  nav: { label: 'Organizer', order: 20, roles: ['organizer', 'admin'] },
};

export default function Organizer() {
  const qc = useQueryClient();
  const { data: events, isLoading } = useQuery({ queryKey: ['my-events'], queryFn: fetchMyEvents });
  const refresh = () => qc.invalidateQueries({ queryKey: ['my-events'] });
  const submit = useMutation({ mutationFn: submitEvent, onSuccess: refresh });
  const cancel = useMutation({ mutationFn: cancelEvent, onSuccess: refresh });

  return (
    <>
      <h1>Organizer workspace</h1>

      <h2>My events</h2>
      <ErrorBox error={submit.error || cancel.error} />
      {isLoading && <Spinner />}
      {events?.length === 0 && <div className="empty">No events yet. Create a venue and your first event below.</div>}
      <div className="card" style={{ padding: 0, display: events?.length ? 'block' : 'none' }}>
        {events?.map((e) => (
          <div key={e.id} className="list-row">
            <div style={{ flex: 1 }}>
              <Link to={`/events/${e.id}`}>
                <strong>{e.title}</strong>
              </Link>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {formatDate(e.startsAt)} - {e.city} - {e.totalSeats} seats
              </div>
              {e.status === 'rejected' && <div className="error-box">Rejected: {e.rejectionReason}</div>}
            </div>
            <span className={`status status-${e.status}`}>{e.status.replace('_', ' ')}</span>
            {['draft', 'rejected'].includes(e.status) && (
              <button className="btn small" onClick={() => submit.mutate(e.id)} disabled={submit.isPending}>
                Submit for approval
              </button>
            )}
            {!['cancelled', 'completed'].includes(e.status) && (
              <button
                className="btn danger small"
                onClick={() => window.confirm('Cancel this event?') && cancel.mutate(e.id)}
              >
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="two-col" style={{ marginTop: 28 }}>
        <VenueForm />
        <EventForm />
      </div>
    </>
  );
}
