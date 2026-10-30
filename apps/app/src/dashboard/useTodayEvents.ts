import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { devMock } from '../lib/dev-mock';
import { apiEventsSource, type EventsSource } from '../lib/events-source';
import { supabase } from '../lib/supabase';
import { eventsState, isStale, msToNextMinute, type EventsState } from './events';

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Not signed in');
  return data.session.access_token;
}

const liveSource = apiEventsSource(accessToken);

/**
 * Today's events for the widget: reads `GET /events/today` on mount and when the app
 * comes back to the foreground with data older than 5 minutes; `refresh` syncs first.
 */
export function useTodayEvents(): {
  state: EventsState;
  /** A read or sync is in flight (spins the refresh button). */
  busy: boolean;
  refresh: () => void;
} {
  const source: EventsSource = devMock?.events ?? liveSource;
  const [state, setState] = useState<EventsState>({ status: 'loading' });
  const [busy, setBusy] = useState(true);
  // Only the latest request may set state; older answers are dropped.
  const request = useRef(0);
  const attemptedAt = useRef(0);

  // Sets state only once the answer is in, so the first load can start from an effect
  // (the initial state is already loading and busy).
  const settle = useCallback(async (fetch: () => Promise<EventsState>) => {
    const id = ++request.current;
    attemptedAt.current = Date.now();
    let next: EventsState;
    try {
      next = await fetch();
    } catch (e) {
      console.warn('Loading events failed:', e instanceof Error ? e.message : e);
      next = { status: 'error' };
    }
    if (id !== request.current) return;
    setState(next);
    setBusy(false);
  }, []);

  const load = useCallback(
    () =>
      settle(async () => {
        const [data, connection] = await Promise.all([
          source.today(),
          // Without a status the events still show; the API answers from its cache.
          source.connection().catch(() => null),
        ]);
        return eventsState(data, connection);
      }),
    [settle, source],
  );

  const refresh = useCallback(() => {
    setBusy(true);
    void settle(async () => {
      const { sync, ...data } = await source.sync();
      return eventsState(data, sync);
    });
  }, [settle, source]);

  useEffect(() => {
    void load();
    const sub = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active' || !isStale(attemptedAt.current, Date.now())) return;
      setBusy(true);
      void load();
    });
    return () => sub.remove();
  }, [load]);

  return { state, busy, refresh };
}

/** The current time, updated at the start of every minute. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, msToNextMinute(Date.now()));
    };
    timer = setTimeout(tick, msToNextMinute(Date.now()));
    return () => clearTimeout(timer);
  }, []);
  return now;
}
