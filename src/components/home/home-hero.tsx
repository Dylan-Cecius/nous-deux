import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssistant } from '@/components/assistant-context';
import { FramedPhoto } from '@/components/framed-photo';
import { CounterSheet } from '@/components/home/counter-card';
import { Avatar, IconButton, Ionicons, Row, T } from '@/components/ui';
import { Fonts, useTheme } from '@/constants/theme';
import { useSession } from '@/lib/couple-context';
import { daysBetween, formatLong, formatNumber, fromKey, nextMilestone } from '@/lib/dates';
import { useTodayKey } from '@/lib/use-today';

const CREAM = '#FFF7EE';
const MUTED = '#E2C9D0';

/** Une couverture personnelle, puis l'histoire du couple en une carte. */
export function HomeHero() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const assistant = useAssistant();
  const { couple, me, partner, backend } = useSession();
  const [open, setOpen] = useState(false);
  const today = useTodayKey();
  const together = couple?.since ? Math.max(0, daysBetween(couple.since, today)) : null;
  const milestone = together !== null ? nextMilestone(together) : null;
  const photo = couple?.photoUrl;

  return (
    <View style={{ paddingTop: insets.top + 18, paddingHorizontal: 22, gap: 22 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 8 }}>
          <Ionicons name="heart-outline" size={22} color={t.primary} />
          <Text style={{ fontFamily: Fonts.display, fontSize: 24, color: t.text }}>nous deux<Text style={{ color: t.primary }}>.</Text></Text>
        </Row>
        <Row>
          {assistant && <IconButton icon="mic-outline" label="Assistant vocal" onPress={() => assistant.open()} />}
          <IconButton icon="person-outline" label="Notre espace et nos réglages" onPress={() => router.push('/nous')} />
        </Row>
      </Row>

      <View style={{ gap: 7 }}>
        <T variant="caption" muted style={{ fontSize: 10, letterSpacing: 1.7 }}>{formatLong(today)}</T>
        <T variant="title" style={{ fontSize: 33, lineHeight: 40 }}>Les petits riens,{ '\n' }<Text style={{ fontFamily: Fonts.displayItalic, color: t.primary }}>c’est tout un nous.</Text></T>
        <T variant="small" muted>Un peu d’organisation. Beaucoup de vous.</T>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Votre histoire : modifier la date de rencontre et la photo"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.story, { backgroundColor: t.feature, opacity: pressed ? 0.92 : 1 }]}>
        {photo ? <FramedPhoto uri={photo} frame={couple?.photoFrame} /> : (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <LinearGradient colors={['#583B48', '#392530', '#2E222A']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.orbit, { right: -70, top: -75 }]} />
            <View style={[styles.orbit, { right: -15, top: -40 }]} />
            <Ionicons name="sparkles-outline" size={36} color="#E9BAA7" style={{ position: 'absolute', right: 32, top: 55, opacity: 0.65 }} />
          </View>
        )}
        {photo && <LinearGradient colors={['rgba(34,18,27,0.45)', 'rgba(34,18,27,0.82)']} style={StyleSheet.absoluteFill} />}
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 8, flex: 1 }}>
            <T variant="caption" color={MUTED} style={{ fontSize: 10 }}>Votre histoire</T>
            <T variant="h2" color={CREAM}>{me?.name ?? 'Toi'} <Text style={{ fontFamily: Fonts.displayItalic, color: '#F3B6A4' }}>&</Text> {partner?.name ?? 'ta moitié'}</T>
          </View>
          <View style={styles.edit}><Ionicons name="create-outline" size={17} color={CREAM} /></View>
        </Row>
        {together !== null && milestone ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 10 }}>
              <Text style={{ fontFamily: Fonts.displayMedium, fontSize: 58, lineHeight: 68, color: CREAM }}>{formatNumber(together)}</Text>
              <Text style={{ fontFamily: Fonts.displayItalic, fontSize: 20, color: '#F3B6A4' }}>jour{together > 1 ? 's' : ''} ensemble</Text>
            </View>
            <T variant="small" color={MUTED}>Depuis le {fromKey(couple!.since!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</T>
            <View style={styles.track}><View style={{ width: `${Math.max(2, milestone.progress * 100)}%`, height: 3, backgroundColor: '#F3B6A4', borderRadius: 3 }} /></View>
            <T variant="small" color={MUTED}>Encore {milestone.left} jour{milestone.left > 1 ? 's' : ''} avant le cap des {formatNumber(milestone.next)}</T>
          </View>
        ) : (
          <View style={{ gap: 7, paddingVertical: 6 }}>
            <T variant="quote" color={CREAM}>Chaque histoire a son premier jour.</T>
            <Row style={{ gap: 6 }}><T variant="small" color={MUTED}>Ajoutez votre date de rencontre</T><Ionicons name="arrow-forward" size={16} color={MUTED} /></Row>
          </View>
        )}
        <Row style={{ borderTopWidth: 1, borderTopColor: '#FFFFFF25', paddingTop: 13, gap: 8 }}>
          <Row style={{ gap: 0 }}>
            <Avatar name={me?.name ?? '?'} color={me?.color ?? t.primary} size={26} ring="#392530" />
            {partner && <View style={{ marginLeft: -5 }}><Avatar name={partner.name} color={partner.color} size={26} ring="#392530" /></View>}
          </Row>
          <T variant="small" color={MUTED} style={{ fontSize: 12 }}>{backend.mode === 'local' ? 'Votre cocon sur ce téléphone' : partner ? 'Votre espace partagé, juste à vous' : 'Votre espace attend ta moitié'}</T>
        </Row>
      </Pressable>
      {open && <CounterSheet onClose={() => setOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  story: { borderRadius: 26, padding: 22, gap: 18, overflow: 'hidden' },
  orbit: { width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: '#F3B6A42B', position: 'absolute' },
  edit: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF15', alignItems: 'center', justifyContent: 'center' },
  track: { height: 3, borderRadius: 3, backgroundColor: '#FFFFFF25', overflow: 'hidden', marginTop: 6 },
});
