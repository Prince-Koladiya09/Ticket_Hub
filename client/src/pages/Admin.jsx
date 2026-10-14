import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveEvent, fetchPending, rejectEvent, suspendUser } from '../api/admin.js';
import { fetchPlatformStats } from '../api/stats.js';
import { Stat } from '../components/EventStats.jsx';
import { ErrorBox, Spinner } from '../components/ui.jsx';
import { formatDate, formatPrice } from '../lib/format.js';

export const route = { path: '/admin', roles: ['admin'], nav: { label: 'Admin', order: 30, roles: ['admin'] } };

export default function Admin() {
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ['platform-stats'], queryFn: fetchPlatformStats });
  const pending = useQuery({ queryKey: ['pending-events'], queryFn: fetchPending });
  const [reasons, setReasons] = useState({});
  const [userId, setUserId] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['pending-events'] });
    qc.invalidateQueries({ queryKey: ['platform-stats'] });
  };
  const approve = useMutation({ mutationFn: approveEvent, onSuccess: refresh });
  const reject = useMutation({ mutationFn: ({ id, reason }) => rejectEvent(id, reason), onSuccess: refresh });
  const suspend = useMutation({ mutationFn: ({ id, suspended }) => suspendUser(id, suspended) });

  return (
    <>
      <h1>Admin console</h1>

      {stats.data && (
        <div className="card stats-grid" style={{ marginBottom: 24 }}>
          <Stat label="Users" value={Object.values(stats.data.users).reduce((a, b) => a + b, 0)} />
          <Stat label="Organizers" value={stats.data.users.organizer ?? 0} />
          <Stat label="Published events" value={stats.data.events.published ?? 0} />
          <Stat label="Awaiting approval" value={stats.data.events.pending_approval ?? 0} />
          <Stat label="Confirmed bookings" value={stats.data.confirmedBookings} />
          <Stat label="Revenue" value={formatPrice(stats.data.revenue)} />
        </div>
      )}

      <h2>Events awaiting approval</h2>
      <ErrorBox error={approve.error || reject.error} />
      {pending.isLoading && <Spinner />}
      {pending.data?.length === 0 && <div className="empty">Nothing to review. All caught up.</div>}
      <div className="stack">
        {pending.data?.map((e) => (
          <div key={e.id} className="card">
            <div className="booking-card">
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: 2 }}>
                  <Link to={`/events/${e.id}`}>{e.title}</Link>
                </h3>
                <div className="muted">
                  {formatDate(e.startsAt)} - {e.venue?.name}, {e.city} - {e.totalSeats} seats
                </div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {e.pricingTiers.map((t) => `${t.name} ${formatPrice(t.price)}`).join(' - ')}
                </div>
              </div>
              <button className="btn small" disabled={approve.isPending} onClick={() => approve.mutate(e.id)}>
                Approve
              </button>
            </div>
            <div className="row" style={{ marginTop: 12, gridTemplateColumns: '1fr auto' }}>
              <input
                placeholder="Reason for rejection (shown to the organizer)"
                value={reasons[e.id] ?? ''}
                onChange={(ev) => setReasons({ ...reasons, [e.id]: ev.target.value })}
              />
              <button
                className="btn danger small"
                disabled={reject.isPending || (reasons[e.id] ?? '').trim().length < 3}
                onClick={() => reject.mutate({ id: e.id, reason: reasons[e.id].trim() })}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 32 }}>Suspend or restore a user</h2>
      <div className="card">
        <div className="row" style={{ gridTemplateColumns: '1fr auto auto' }}>
          <input placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value.trim())} />
          <button
            className="btn danger small"
            disabled={userId.length !== 24 || suspend.isPending}
            onClick={() => suspend.mutate({ id: userId, suspended: true })}
          >
            Suspend
          </button>
          <button
            className="btn secondary small"
            disabled={userId.length !== 24 || suspend.isPending}
            onClick={() => suspend.mutate({ id: userId, suspended: false })}
          >
            Restore
          </button>
        </div>
        <ErrorBox error={suspend.error} />
        {suspend.isSuccess && <div className="success-box">Updated. Suspended users lose access within one token lifetime.</div>}
      </div>
    </>
  );
}
