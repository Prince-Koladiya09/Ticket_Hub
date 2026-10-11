import { Link } from 'react-router-dom';
import { formatPrice, formatShortDate, titleCase } from '../lib/format.js';

const GRADIENTS = {
  concert: 'linear-gradient(135deg,#6c5ce7,#a29bfe)',
  sports: 'linear-gradient(135deg,#00b894,#55efc4)',
  theatre: 'linear-gradient(135deg,#d63031,#ff7675)',
  comedy: 'linear-gradient(135deg,#fdcb6e,#e17055)',
  conference: 'linear-gradient(135deg,#0984e3,#74b9ff)',
  festival: 'linear-gradient(135deg,#e84393,#fd79a8)',
  other: 'linear-gradient(135deg,#636e72,#b2bec3)',
};

export default function EventCard({ event }) {
  const banner = event.bannerUrl
    ? { backgroundImage: `url(${event.bannerUrl})` }
    : { background: GRADIENTS[event.category] ?? GRADIENTS.other };

  return (
    <Link to={`/events/${event.id}`} className="event-card">
      <div className="event-banner" style={banner}>
        <span className="chip">{titleCase(event.category)}</span>
        <span className="date-badge">{formatShortDate(event.startsAt)}</span>
      </div>
      <div className="event-body">
        <h3>{event.title}</h3>
        <div className="muted">{event.city}</div>
        <div className="price">
          From <strong>{formatPrice(event.minPrice)}</strong>
        </div>
      </div>
    </Link>
  );
}
