import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createEvent, fetchVenues } from '../api/events.js';
import { CATEGORIES, titleCase } from '../lib/format.js';
import { ErrorBox } from './ui.jsx';

export default function EventForm() {
  const qc = useQueryClient();
  const { data: venues = [] } = useQuery({ queryKey: ['venues'], queryFn: fetchVenues });
  const [form, setForm] = useState({ title: '', description: '', category: 'concert', startsAt: '', venueId: '', bannerUrl: '' });
  const [tiers, setTiers] = useState([{ name: 'Standard', price: 500 }]);

  const mutation = useMutation({
    mutationFn: () =>
      createEvent({
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        pricingTiers: tiers.map((t) => ({ name: t.name, price: Number(t.price) })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-events'] });
      setForm({ title: '', description: '', category: 'concert', startsAt: '', venueId: '', bannerUrl: '' });
    },
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setTier = (i, key, value) => setTiers(tiers.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h3>Create an event</h3>
      <label>Title</label>
      <input required minLength={3} value={form.title} onChange={set('title')} />
      <div className="row">
        <div>
          <label>Category</label>
          <select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Starts at</label>
          <input type="datetime-local" required value={form.startsAt} onChange={set('startsAt')} />
        </div>
      </div>
      <label>Venue</label>
      <select required value={form.venueId} onChange={set('venueId')}>
        <option value="">Select a venue...</option>
        {venues.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} - {v.city} ({v.capacity} seats)
          </option>
        ))}
      </select>
      <label>Description</label>
      <textarea rows={3} value={form.description} onChange={set('description')} />
      <label>Banner image URL (optional)</label>
      <input type="url" value={form.bannerUrl} onChange={set('bannerUrl')} />

      <label>Pricing tiers (must match the venue's section tiers, if it has any)</label>
      {tiers.map((t, i) => (
        <div key={i} className="row section-row">
          <input placeholder="Tier name" required value={t.name} onChange={(e) => setTier(i, 'name', e.target.value)} />
          <input type="number" min="0" required value={t.price} onChange={(e) => setTier(i, 'price', e.target.value)} />
          {tiers.length > 1 && (
            <button type="button" className="btn secondary small" onClick={() => setTiers(tiers.filter((_, idx) => idx !== i))}>
              x
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn secondary small" onClick={() => setTiers([...tiers, { name: '', price: 0 }])}>
        + Add tier
      </button>
      <ErrorBox error={mutation.error} />
      {mutation.isSuccess && <div className="success-box">Draft created. Submit it for approval below.</div>}
      <div style={{ marginTop: 14 }}>
        <button className="btn" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating...' : 'Create draft'}
        </button>
      </div>
    </form>
  );
}
