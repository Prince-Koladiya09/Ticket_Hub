import { useQuery } from '@tanstack/react-query';
import { get } from './http.js';

const DEFAULTS = { seatLockTtl: 300, maxSeatsPerBooking: 6, paymentsEnabled: false, devConfirmEnabled: false };

/** Server-side policy (limits, feature flags) so the UI never hardcodes it. */
export function useConfig() {
  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: () => get('/config').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  return data ?? DEFAULTS;
}
