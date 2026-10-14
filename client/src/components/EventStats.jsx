import { useQuery } from '@tanstack/react-query';
import { fetchEventStats } from '../api/stats.js';
import { formatPrice } from '../lib/format.js';
import { ErrorBox, Spinner } from './ui.jsx';

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="muted">{label}</div>
    </div>
  );
}

/** Sales, occupancy and attendance for one event. Refreshes every 10s so organizers see sales live. */
export default function EventStats({ eventId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['event-stats', eventId],
    queryFn: () => fetchEventStats(eventId),
    refetchInterval: 10_000,
  });

  if (isLoading) return <Spinner label="Loading stats..." />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div className="stats-panel">
      <div className="stats-grid">
        <Stat label="Revenue" value={formatPrice(data.revenue)} />
        <Stat label="Seats sold" value={`${data.soldSeats} / ${data.totalSeats}`} />
        <Stat label="Bookings" value={data.bookings} />
        <Stat label="Held now" value={data.activeHolds} />
        <Stat label="Checked in" value={data.checkedIn} />
      </div>
      <div className="progress" title={`${data.occupancyPct}% occupancy`}>
        <div className="progress-bar" style={{ width: `${data.occupancyPct}%` }} />
      </div>
      <div className="muted" style={{ fontSize: '0.85rem' }}>
        {data.occupancyPct}% occupancy
        {data.byTier.map((t) => ` - ${t.tier}: ${t.seats} seats (${formatPrice(t.revenue)})`).join('')}
      </div>
    </div>
  );
}
