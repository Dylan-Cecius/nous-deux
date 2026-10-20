import { useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { todayKey } from './dates';

// One local clock for all mounted consumers. No polling of a backend and no
// background job: the timer is stopped when the app is inactive or unobserved.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let subscription: ReturnType<typeof AppState.addEventListener> | undefined;
let observedDay: string;
let foreground = false;
const isForeground = (state: AppStateStatus | null) => state === 'active' || state === 'unknown' || state === null;

function cancelTimer() {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function refresh() {
  const day = todayKey();
  if (day === observedDay) return;
  observedDay = day;
  for (const listener of listeners) listener();
}

function schedule() {
  cancelTimer();
  if (!foreground || listeners.size === 0) return;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  // The minute cap also catches clock/time-zone changes while foregrounded.
  // Calendar midnight (not +24 h) handles daylight-saving days.
  const delay = Math.max(1, Math.min(60_000, midnight.getTime() - now.getTime() + 25));
  timer = setTimeout(() => { refresh(); schedule(); }, delay);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    observedDay = todayKey();
    foreground = isForeground(AppState.currentState);
    subscription = AppState.addEventListener('change', (state) => {
      foreground = isForeground(state);
      if (foreground) refresh();
      schedule();
    });
    schedule();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      cancelTimer();
      subscription?.remove();
      subscription = undefined;
    }
  };
}

/** Local calendar day, refreshed on resume and near midnight without a write. */
export function useToday() {
  return useSyncExternalStore(subscribe, todayKey, todayKey);
}
