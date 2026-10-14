# Load tests (k6)

Two scenarios that exercise the design decisions in `docs/02-System-Design.md`.

| Script | What it proves |
|---|---|
| `hold-contention.js` | 20 users race for one seat: **exactly one** hold succeeds, the rest get `409 SEATS_UNAVAILABLE` and there are no 5xx. |
| `browse.js` | Cached listing/detail endpoints hold p95 < 200 ms at 100 concurrent users. |

## Running

```bash
npm run seed --prefix server -- --reset      # creates buyer1..buyer20@tickethub.dev
```

The API rate limiter would (rightly) throttle a load test coming from one IP, so start the API with the
budgets raised:

```bash
GLOBAL_RATE_LIMIT=100000 AUTH_RATE_LIMIT=1000 HOLD_RATE_LIMIT=1000 npm run dev --prefix server
```

```bash
k6 run -e BASE_URL=http://localhost:4000/api/v1 infra/k6/hold-contention.js
k6 run -e BASE_URL=http://localhost:4000/api/v1 infra/k6/browse.js
```

Against the full stack behind Nginx use `BASE_URL=http://localhost/api/v1` and set the same variables for
the `api` service in `docker-compose.yml`.

## Recording results

For the README, run `browse.js` twice: once right after `redis-cli flushall` (cold) and once warm, then
note the p95 and the `tickethub_cache_requests_total` hit ratio from `/metrics`.
