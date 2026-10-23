import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

// All mounted consumers observe the same device preference. Keep one native
// listener/read, and forget the cached value when the last consumer leaves.
const listeners = new Set<() => void>();
let reduced = true;
let stop: (() => void) | undefined;
const snapshot = () => reduced;
const staticSnapshot = () => true;

function update(enabled: boolean) {
  const next = enabled !== false;
  if (next === reduced) return;
  reduced = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (!active) return;
      changed = true;
      update(enabled);
    });
    void Promise.resolve().then(() => AccessibilityInfo.isReduceMotionEnabled()).then((enabled) => {
      if (active && !changed) update(enabled);
    }).catch(() => {
      // No decorative movement when the platform preference cannot be read.
    });
    stop = () => {
      active = false;
      subscription?.remove();
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop?.();
      stop = undefined;
      reduced = true;
    }
  };
}

/** Prefer a static presentation until the shared system preference is known. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, staticSnapshot);
}
