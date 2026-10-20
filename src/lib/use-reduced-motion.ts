import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Prefer a static presentation until the system preference is known. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (!active) return;
      changed = true;
      setReduced(enabled !== false);
    });
    void Promise.resolve().then(() => AccessibilityInfo.isReduceMotionEnabled()).then((enabled) => {
      if (active && !changed) setReduced(enabled !== false);
    }).catch(() => {
      // No decorative movement when the platform preference cannot be read.
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  return reduced;
}
