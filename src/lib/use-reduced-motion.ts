import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Attend la préférence système avant de lancer des animations décoratives. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let eventReceived = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      eventReceived = true;
      setReduced(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !eventReceived) setReduced(value);
    }).catch(() => {});
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
