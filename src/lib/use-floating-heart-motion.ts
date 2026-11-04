import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from './use-reduced-motion';

/** Shared motion controller; keeps logo assets and layout in their existing screens. */
export function useFloatingHeartMotion(duration: number) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [duration, progress, reducedMotion]);

  return {
    translateY: reducedMotion ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }),
    scale: reducedMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }),
  };
}
