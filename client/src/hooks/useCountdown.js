import { useEffect, useState } from 'react';

/** Seconds remaining until `iso`, ticking every second. Returns 0 once expired. */
export function useCountdown(iso) {
  const compute = () => (iso ? Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000)) : 0);
  const [seconds, setSeconds] = useState(compute);

  useEffect(() => {
    setSeconds(compute());
    const t = setInterval(() => setSeconds(compute()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  return seconds;
}

export const formatClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
