// Many users race for the SAME seat at the same moment. Exactly one hold may succeed.
//
//   k6 run -e BASE_URL=http://localhost/api/v1 infra/k6/hold-contention.js
//
// Needs seeded users (npm run seed) and the API started with HOLD_RATE_LIMIT / AUTH_RATE_LIMIT /
// GLOBAL_RATE_LIMIT raised, otherwise the rate limiter (correctly) throttles the test itself.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const USERS = Number(__ENV.USERS || 20);
const PASSWORD = __ENV.PASSWORD || 'Buyer@12345';
const EVENT_TITLE = __ENV.EVENT_TITLE || 'Stand-up Saturday';

const won = new Counter('holds_won');
const lost = new Counter('holds_lost');
const unexpected = new Counter('holds_unexpected');

http.setResponseCallback(http.expectedStatuses(200, 201, 409));

export const options = {
  scenarios: {
    rush: { executor: 'per-vu-iterations', vus: USERS, iterations: 1, maxDuration: '60s' },
  },
  thresholds: {
    holds_won: ['count==1'], // the invariant: one seat, one winner
    holds_lost: [`count==${USERS - 1}`],
    holds_unexpected: ['count==0'],
    // Latency is informational and depends on your database; tighten it for your hardware.
    'http_req_duration{name:hold}': [`p(95)<${__ENV.HOLD_P95_MS || 1500}`],
  },
};

const json = { 'Content-Type': 'application/json' };

export function setup() {
  const tokens = [];
  for (let i = 1; i <= USERS; i += 1) {
    const res = http.post(`${BASE}/auth/login`, JSON.stringify({ email: `buyer${i}@tickethub.dev`, password: PASSWORD }), { headers: json });
    if (res.status !== 200) throw new Error(`login failed for buyer${i}: ${res.status} ${res.body}`);
    tokens.push(res.json('data.accessToken'));
  }

  const events = http.get(`${BASE}/events?limit=50`).json('data');
  const event = events.find((e) => e.title === EVENT_TITLE) || events[0];
  const map = http.get(`${BASE}/events/${event.id}/seats`, { headers: { Authorization: `Bearer ${tokens[0]}` } }).json('data');
  const free = map.seats.filter((s) => s.status === 'available');
  const seat = free[Math.floor(Math.random() * free.length)];
  console.log(`Racing ${USERS} users for ${event.title} seat ${seat.section} ${seat.row}${seat.number}`);
  return { tokens, eventId: event.id, seatId: seat.id };
}

export default function (data) {
  const token = data.tokens[__VU - 1];
  const res = http.post(
    `${BASE}/bookings/hold`,
    JSON.stringify({ eventId: data.eventId, seatIds: [data.seatId] }),
    { headers: { ...json, Authorization: `Bearer ${token}` }, tags: { name: 'hold' } },
  );

  if (res.status === 201) {
    won.add(1);
    // Give the seat back so the test can be re-run against the same data.
    sleep(1);
    http.del(`${BASE}/bookings/${res.json('data.bookingId')}/hold`, null, { headers: { Authorization: `Bearer ${token}` } });
  } else if (res.status === 409 && res.json('error.code') === 'SEATS_UNAVAILABLE') {
    lost.add(1);
  } else {
    unexpected.add(1);
    console.error(`unexpected response: ${res.status} ${res.body}`);
  }
  check(res, { 'no server error': (r) => r.status < 500 });
}
