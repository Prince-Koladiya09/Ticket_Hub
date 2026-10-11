import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchEvents } from '../api/events.js';
import EventCard from '../components/EventCard.jsx';
import { ErrorBox, Spinner } from '../components/ui.jsx';
import { CATEGORIES, titleCase } from '../lib/format.js';

export const route = { path: '/', nav: { label: 'Events', order: 1 } };

const EMPTY = { q: '', city: '', category: '' };

export default function Home() {
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);

  const query = useInfiniteQuery({
    queryKey: ['events', filters],
    queryFn: ({ pageParam }) => {
      const params = Object.fromEntries(Object.entries({ ...filters, cursor: pageParam, limit: 12 }).filter(([, v]) => v));
      return fetchEvents(params);
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const events = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <section className="hero">
        <h1>Find your next live experience</h1>
        <p>Real-time seat maps, safe checkout holds and instant tickets.</p>
      </section>

      <form
        className="filters card"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draft);
        }}
      >
        <input placeholder="Search events..." value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        <input placeholder="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {titleCase(c)}
            </option>
          ))}
        </select>
        <button className="btn">Search</button>
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            setDraft(EMPTY);
            setFilters(EMPTY);
          }}
        >
          Reset
        </button>
      </form>

      {query.isLoading && <Spinner label="Loading events..." />}
      {query.error && <ErrorBox error={query.error} />}
      {!query.isLoading && !events.length && !query.error && (
        <div className="empty">No upcoming events match your search.</div>
      )}

      <div className="grid">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>

      {query.hasNextPage && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="btn secondary" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}
