import client from 'prom-client';

client.collectDefaultMetrics({ prefix: 'tickethub_' });

export const registry = client.register;

export const httpDuration = new client.Histogram({
  name: 'tickethub_http_request_duration_seconds',
  help: 'HTTP request latency by route pattern and status',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const seatLockAttempts = new client.Counter({
  name: 'tickethub_seat_lock_attempts_total',
  help: 'Seat lock attempts by outcome (success|conflict)',
  labelNames: ['result'],
});

export const bookingTransitions = new client.Counter({
  name: 'tickethub_booking_transitions_total',
  help: 'Booking state transitions',
  labelNames: ['to'],
});

export const cacheRequests = new client.Counter({
  name: 'tickethub_cache_requests_total',
  help: 'Cache lookups by result (hit|miss)',
  labelNames: ['result'],
});

export const activeSockets = new client.Gauge({
  name: 'tickethub_sockets_active',
  help: 'Currently connected WebSocket clients on this instance',
});

/**
 * Records request latency. The label is the matched route PATTERN (/api/v1/events/:id), never the raw
 * URL, so ids don't explode the number of time series.
 */
export function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
}
