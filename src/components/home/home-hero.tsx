import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssistant } from '@/components/assistant-context';
import { FramedPhoto } from '@/components/framed-photo';
import { CounterSheet } from '@/components/home/counter-card';
import { Ionicons, Row, T } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useSession } from '@/lib/couple-context';
import { daysBetween, formatLong, formatNumber, fromKey, nextMilestone } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { useFloatingHeartMotion } from '@/lib/use-floating-heart-motion';

const CREAM = '#FBF6F1';
const PINK = '#FF8FB8';
const MUTED = 'rgba(251,246,241,0.75)';

/** Le cœur du logo qui flotte doucement dans le bandeau. */
function FloatingHeart() {
  const { translateY } = useFloatingHeartMotion(2000);
  return (
    <Animated.Image
      source={require('@/assets/images/logo-heart.png')}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        position: 'absolute',
        right: -24,
        top: 46,
        width: 170,
        height: 170,
        opacity: 0.9,
        transform: [{ translateY }],
      }}
    />
  );
}

/**
 * Bandeau de l'Accueil, dans la même ambiance que le logo : fond prune (ou votre photo de couple),
 * vos prénoms, le compteur de jours et la progression vers le prochain cap.
 */
export function HomeHero() {
  const insets = useSafeAreaInsets();
  const assistant = useAssistant();
  const { couple, me, partner } = useSession();
  const [open, setOpen] = useState(false);

  const today = useToday();
  const together = couple?.since ? daysBetween(couple.since, today) : null;
  const milestone = together !== null ? nextMilestone(together) : null;
  const photo = couple?.photoUrl;

  return (
    <View style={styles.hero}>
      {photo ? (
        <>
          <FramedPhoto uri={photo} frame={couple?.photoFrame} />
          <LinearGradient
            colors={['rgba(26,11,20,0.55)', 'rgba(26,11,20,0.35)', 'rgba(26,11,20,0.85)']}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          <LinearGradient colors={['#4A2238', '#2A1420', '#1F0E18']} style={StyleSheet.absoluteFill} />
          <FloatingHeart />
        </>
      )}

      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 22, paddingBottom: 54, gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="caption" color={MUTED}>
            {formatLong(today)}
          </T>
          {assistant && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Assistant vocal"
              onPress={() => assistant.open()}
              style={({ pressed }) => [styles.mic, { opacity: pressed ? 0.75 : 1 }]}>
              <LinearGradient colors={['#FFA36C', '#FF5A7A', '#E0479E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="mic" size={20} color="#fff" />
            </Pressable>
          )}
        </Row>

        <Text style={{ fontFamily: Fonts.display, fontSize: 34, lineHeight: 40, color: CREAM, maxWidth: '78%' }}>
          {partner ? (
            <>
              {me?.name} <Text style={{ fontFamily: Fonts.displayItalic, color: PINK }}>&amp;</Text> {partner.name}
            </>
          ) : (
            `Coucou ${me?.name ?? ''}`
          )}
        </Text>

        <Pressable accessibilityRole="button" accessibilityLabel="Votre histoire : date de rencontre et photo" onPress={() => setOpen(true)} style={{ gap: 10, paddingTop: 6 }}>
          {together !== null && milestone ? (
            <>
              <Row style={{ alignItems: 'baseline', gap: 10 }}>
                <Text style={{ fontFamily: Fonts.displayMedium, fontSize: 64, lineHeight: 68, color: CREAM }}>
                  {formatNumber(together)}
                </Text>
                <Text style={{ fontFamily: Fonts.displayItalic, fontSize: 22, color: PINK }}>
                  {together > 1 ? 'jours ensemble' : 'jour ensemble'}
                </Text>
              </Row>
              <T variant="small" color={MUTED}>
                Depuis le {fromKey(couple!.since!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </T>
              <View style={styles.track}>
                <View style={{ width: `${Math.max(4, milestone.progress * 100)}%`, height: '100%', borderRadius: 4, overflow: 'hidden' }}>
                  <LinearGradient colors={['#FFC07A', '#FF5A7A', '#E0479E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                </View>
              </View>
              <T variant="small" color={MUTED}>
                Cap des {formatNumber(milestone.next)} jours dans {milestone.left} jour{milestone.left > 1 ? 's' : ''}
              </T>
            </>
          ) : (
            <View style={styles.cta}>
              <Ionicons name="heart-circle-outline" size={26} color={PINK} />
              <View style={{ flex: 1 }}>
                <T variant="bodyBold" color={CREAM}>
                  Depuis quand êtes-vous ensemble ?
                </T>
                <T variant="small" color={MUTED}>
                  Ajoutez votre date de rencontre et une photo de vous deux.
                </T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </View>
          )}
        </Pressable>
      </View>

      {open && <CounterSheet onClose={() => setOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    backgroundColor: '#2A1420',
  },
  mic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,170,0.22)',
  },
});
