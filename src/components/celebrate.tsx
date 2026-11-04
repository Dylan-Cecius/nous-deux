import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useReducedMotion } from '@/lib/use-reduced-motion';

type Kind = 'hearts' | 'confetti';
type Listener = (kind: Kind, message?: string) => void;

const listeners = new Set<Listener>();

/**
 * Lance une petite animation de fête (cœurs qui s'envolent ou confettis) par-dessus l'écran,
 * avec un message facultatif affiché au centre.
 */
export function celebrate(kind: Kind, message?: string) {
  listeners.forEach((l) => l(kind, message));
}

/** Bulle de message qui apparaît puis s'efface. */
function Message({ text, animate }: { text: string; animate: boolean }) {
  const progress = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!animate) return;
    const animation = Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(progress, { toValue: 2, duration: 400, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress, animate]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: '38%',
        alignSelf: 'center',
        backgroundColor: 'rgba(42,26,34,0.88)',
        paddingVertical: 14,
        paddingHorizontal: 22,
        borderRadius: 999,
        opacity: animate ? progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }) : 1,
        transform: animate ? [{ scale: progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0.8, 1, 0.95] }) }] : undefined,
      }}>
      <Text style={{ color: '#fff', fontFamily: Fonts.bodyBold, fontSize: 17 }}>{text}</Text>
    </Animated.View>
  );
}

const CONFETTI_COLORS = ['#C8385A', '#FF8FA8', '#E07B39', '#2F5D9E', '#1F7A55', '#F2C14E'];

type Particle = { id: number; x: number; delay: number; drift: number; size: number; color: string; spin: number };

function makeParticles(kind: Kind, width: number): Particle[] {
  const count = kind === 'hearts' ? 14 : 44;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: kind === 'hearts' ? width / 2 + (Math.random() - 0.5) * width * 0.5 : Math.random() * width,
    delay: Math.random() * (kind === 'hearts' ? 400 : 250),
    drift: (Math.random() - 0.5) * (kind === 'hearts' ? 120 : 80),
    size: kind === 'hearts' ? 18 + Math.random() * 18 : 6 + Math.random() * 6,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    spin: (Math.random() - 0.5) * 720,
  }));
}

function Piece({ p, kind, height }: { p: Particle; kind: Kind; height: number }) {
  const progress = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: kind === 'hearts' ? 1600 : 1900,
      delay: p.delay,
      easing: kind === 'hearts' ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, p.delay, kind]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: kind === 'hearts' ? [height * 0.75, height * 0.2] : [-20, height + 20],
  });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.75, 1],
    outputRange: kind === 'hearts' ? [0, 1, 1, 0] : [1, 1, 1, 0],
  });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] });
  const scale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.1, 0.9] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: p.x,
        top: 0,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }, ...(kind === 'hearts' ? [{ scale }] : [])],
      }}>
      {kind === 'hearts' ? (
        <Ionicons name="heart" size={p.size} color={p.color === '#2F5D9E' ? '#FF8FA8' : '#C8385A'} />
      ) : (
        <View style={{ width: p.size, height: p.size * 1.6, borderRadius: 2, backgroundColor: p.color }} />
      )}
    </Animated.View>
  );
}

/** À placer une fois, au-dessus des écrans. */
export function CelebrationLayer() {
  const reducedMotion = useReducedMotion();
  const [burst, setBurst] = useState<{ key: number; kind: Kind; message?: string; particles: Particle[] } | null>(null);
  const sequence = useRef(0);
  const { height } = Dimensions.get('window');

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onCelebrate: Listener = (kind, message) => {
      const key = ++sequence.current;
      clearTimeout(timeout);
      setBurst({ key, kind, message, particles: makeParticles(kind, Math.min(Dimensions.get('window').width, 430)) });
      timeout = setTimeout(() => setBurst((b) => (b?.key === key ? null : b)), message ? 2900 : 2400);
    };
    listeners.add(onCelebrate);
    return () => {
      listeners.delete(onCelebrate);
      clearTimeout(timeout);
    };
  }, []);

  if (!burst) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!reducedMotion && burst.particles.map((p) => (
        <Piece key={`${burst.key}-${p.id}`} p={p} kind={burst.kind} height={height} />
      ))}
      {burst.message && <Message key={`msg-${burst.key}`} text={burst.message} animate={!reducedMotion} />}
    </View>
  );
}
