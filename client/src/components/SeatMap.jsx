import { useMemo } from 'react';
import { formatPrice } from '../lib/format.js';

const rowSort = (a, b) => a.length - b.length || a.localeCompare(b);

/**
 * Renders sections -> rows -> seats.
 *  - status: 'available' | 'locked' | 'booked' (from the server, kept live over WebSocket)
 *  - `selected`: Set of seat ids the user is picking right now
 *  - `mine`: Set of seat ids covered by the user's active hold
 */
export default function SeatMap({ seats, sections, selected, mine, onToggle, disabled }) {
  const grouped = useMemo(() => {
    const bySection = new Map(sections.map((s) => [s.name, new Map()]));
    for (const seat of seats) {
      if (!bySection.has(seat.section)) bySection.set(seat.section, new Map());
      const rows = bySection.get(seat.section);
      if (!rows.has(seat.row)) rows.set(seat.row, []);
      rows.get(seat.row).push(seat);
    }
    return [...bySection.entries()].map(([name, rows]) => ({
      name,
      rows: [...rows.entries()].sort(([a], [b]) => rowSort(a, b)).map(([row, list]) => [row, list.sort((a, b) => a.number - b.number)]),
    }));
  }, [seats, sections]);

  return (
    <div className="seatmap">
      <div className="stage">STAGE</div>
      {grouped.map((section) => {
        const sample = section.rows[0]?.[1][0];
        return (
          <div key={section.name} className="seat-section">
            <div className="seat-section-title">
              {section.name}
              {sample && (
                <span className="muted">
                  {' '}
                  - {sample.tier} - {formatPrice(sample.price)}
                </span>
              )}
            </div>
            {section.rows.map(([row, list]) => (
              <div key={row} className="seat-row">
                <span className="row-label">{row}</span>
                {list.map((seat) => {
                  const isMine = mine.has(seat.id);
                  const isSelected = selected.has(seat.id);
                  const state = isMine ? 'mine' : isSelected ? 'selected' : seat.status;
                  const clickable = !disabled && !isMine && seat.status === 'available';
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      className={`seat seat-${state}`}
                      disabled={!clickable && !isSelected}
                      onClick={() => onToggle(seat)}
                      title={`${seat.section} ${seat.row}${seat.number} - ${formatPrice(seat.price)} (${state})`}
                      aria-label={`Seat ${seat.row}${seat.number}, ${state}`}
                      aria-pressed={isSelected}
                    >
                      {seat.number}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}

      <div className="legend">
        <span><i className="seat seat-available" /> Available</span>
        <span><i className="seat seat-selected" /> Selected</span>
        <span><i className="seat seat-locked" /> Held by someone</span>
        <span><i className="seat seat-booked" /> Booked</span>
      </div>
    </div>
  );
}
