// Read-heavy traffic: the event listing and detail pages (served from the Redis cache).
//
//   k6 run -e BASE_URL=http://localhost/api/v1 infra/k6/browse.js
//
// Run it once with the cache warm and once after `redis-cli flushall` to see the difference.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:4000/api/v1';

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],
  },
};

export function setup() {
  const events = http.get(`${BASE}/events?limit=50`).json('data');
  return { ids: events.map((e) => e.id) };
}

export default function (data) {
  const list = http.get(`${BASE}/events?limit=12`, { tags: { name: 'list' } });
  check(list, { 'list 200': (r) => r.status === 200 });

  const id = data.ids[Math.floor(Math.random() * data.ids.length)];
  const detail = http.get(`${BASE}/events/${id}`, { tags: { name: 'detail' } });
  check(detail, { 'detail 200': (r) => r.status === 200 });

  sleep(0.5);
}
