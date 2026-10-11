import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeats, rowLabel } from '../src/modules/seats/seatGenerator.js';

test('rowLabel produces spreadsheet-style labels', () => {
  assert.equal(rowLabel(0), 'A');
  assert.equal(rowLabel(25), 'Z');
  assert.equal(rowLabel(26), 'AA');
  assert.equal(rowLabel(27), 'AB');
  assert.equal(rowLabel(51), 'AZ');
  assert.equal(rowLabel(52), 'BA');
});

test('buildSeats creates rows x cols seats per section with tier pricing', () => {
  const seats = buildSeats({
    eventId: 'evt1',
    sections: [
      { name: 'VIP', rows: 2, cols: 3, tier: 'Gold' },
      { name: 'General', rows: 1, cols: 4 },
    ],
    pricingTiers: [
      { name: 'Silver', price: 500 },
      { name: 'Gold', price: 2000 },
    ],
  });
  assert.equal(seats.length, 2 * 3 + 1 * 4);
  const vip = seats.filter((s) => s.section === 'VIP');
  assert.ok(vip.every((s) => s.price === 2000 && s.tier === 'Gold'));
  // Section without a tier falls back to the first tier.
  const general = seats.filter((s) => s.section === 'General');
  assert.ok(general.every((s) => s.price === 500 && s.tier === 'Silver'));
  assert.deepEqual(vip.slice(0, 4).map((s) => `${s.row}${s.number}`), ['A1', 'A2', 'A3', 'B1']);
});

test('buildSeats rejects a section that references an unknown tier', () => {
  assert.throws(
    () => buildSeats({ eventId: 'e', sections: [{ name: 'X', rows: 1, cols: 1, tier: 'Nope' }], pricingTiers: [{ name: 'A', price: 1 }] }),
    /not in the event's pricing tiers/,
  );
});

test('seat identifiers are unique within an event', () => {
  const seats = buildSeats({
    eventId: 'e',
    sections: [{ name: 'A', rows: 30, cols: 30 }],
    pricingTiers: [{ name: 'Std', price: 100 }],
  });
  const ids = new Set(seats.map((s) => `${s.section}-${s.row}-${s.number}`));
  assert.equal(ids.size, seats.length);
});
