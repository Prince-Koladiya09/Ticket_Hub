import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVenue } from '../api/events.js';
import { ErrorBox } from './ui.jsx';

const emptySection = { name: '', rows: 5, cols: 10, tier: '' };

export default function VenueForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', city: '', address: '' });
  const [sections, setSections] = useState([{ ...emptySection, name: 'Main' }]);

  const mutation = useMutation({
    mutationFn: () =>
      createVenue({
        ...form,
        sections: sections.map((s) => ({ ...s, rows: Number(s.rows), cols: Number(s.cols), tier: s.tier || undefined })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues'] });
      setForm({ name: '', city: '', address: '' });
      setSections([{ ...emptySection, name: 'Main' }]);
    },
  });

  const setSection = (i, key, value) => setSections(sections.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h3>Create a venue</h3>
      <div className="row">
        <div>
          <label>Name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label>City</label>
          <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
      </div>
      <label>Address</label>
      <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

      <label>Seating sections</label>
      {sections.map((s, i) => (
        <div key={i} className="row section-row">
          <input placeholder="Name" required value={s.name} onChange={(e) => setSection(i, 'name', e.target.value)} />
          <input type="number" min="1" max="50" title="Rows" value={s.rows} onChange={(e) => setSection(i, 'rows', e.target.value)} />
          <input type="number" min="1" max="50" title="Seats per row" value={s.cols} onChange={(e) => setSection(i, 'cols', e.target.value)} />
          <input placeholder="Tier (optional)" value={s.tier} onChange={(e) => setSection(i, 'tier', e.target.value)} />
          {sections.length > 1 && (
            <button type="button" className="btn secondary small" onClick={() => setSections(sections.filter((_, idx) => idx !== i))}>
              x
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn secondary small" onClick={() => setSections([...sections, { ...emptySection }])}>
        + Add section
      </button>
      <ErrorBox error={mutation.error} />
      <div style={{ marginTop: 14 }}>
        <button className="btn" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save venue'}
        </button>
      </div>
    </form>
  );
}
