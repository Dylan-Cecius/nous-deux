import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { celebrate } from '@/components/celebrate';
import { showDialog } from '@/components/dialog';
import { Card, confirmDelete, Dot, Field, IconButton, Ionicons, Row, T } from '@/components/ui';
import { cardShadow, Fonts, useTheme } from '@/constants/theme';
import { sendLoveNote } from '@/lib/assistant';
import { useCollection, useSession } from '@/lib/couple-context';
import { formatRelative, quote } from '@/lib/dates';
import { bump, success } from '@/lib/haptics';
import { useAsyncAction } from '@/lib/use-async-action';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** Bouton « Je pense à toi » : un appui envoie un cœur et une notification à ta moitié. */
export function PingCard() {
  const t = useTheme();
  const session = useSession();
  const { backend, partner } = session;
  const notes = useCollection('notes');
  const beat = useState(() => new Animated.Value(1))[0];
  const [sent, setSent] = useState(false);
  const reducedMotion = useReducedMotion();
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (sentTimer.current) clearTimeout(sentTimer.current);
    };
  }, []);

  // Le cœur bat doucement en continu.
  useEffect(() => {
    if (reducedMotion) {
      beat.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1.18, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1.12, duration: 160, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      beat.setValue(1);
    };
  }, [beat, reducedMotion]);

  const lastReceived = notes
    .filter((n) => n.kind === 'ping' && n.from !== backend.userId)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  const { run: ping, pending } = useAsyncAction(async () => {
    await sendLoveNote(session, '💗', 'ping');
    if (!mounted.current) return;
    success();
    if (!reducedMotion) celebrate('hearts');
    setSent(true);
    if (sentTimer.current) clearTimeout(sentTimer.current);
    sentTimer.current = setTimeout(() => setSent(false), 2500);
  });
  const waitingForPartner = backend.mode === 'cloud' && !partner;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Envoyer « je pense à toi »"
      onPress={ping}
      disabled={pending || sent || waitingForPartner}
      accessibilityState={{ disabled: pending || sent || waitingForPartner, busy: pending }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          backgroundColor: t.card,
          borderRadius: 22,
          padding: 16,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        cardShadow(t.shadow),
      ]}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ transform: [{ scale: beat }] }}>
          <Ionicons name="heart" size={28} color={t.primary} />
        </Animated.View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="h3">{sent ? backend.mode === 'local' ? 'Cœur enregistré !' : 'Cœur envoyé !' : 'Je pense à toi'}</T>
        <T variant="small" muted>
          {waitingForPartner ? 'Invite ta moitié pour lui envoyer un petit cœur.' : backend.mode === 'local' ? 'Un petit cœur conservé sur ce téléphone.' : lastReceived && partner
            ? `${partner.name} a pensé à toi ${formatRelative(lastReceived.createdAt)}`
            : `Un appui, et ${partner?.name ?? 'ta moitié'} reçoit un petit cœur`}
        </T>
      </View>
      <Ionicons name="paper-plane-outline" size={20} color={t.primary} />
    </Pressable>
  );
}

/** Dernier mot doux reçu, champ pour en écrire un, historique. */
export function NoteCard() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const session = useSession();
  const { backend, partner, nameOf, colorOf } = session;
  const notes = useCollection('notes');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const written = notes.filter((n) => n.kind !== 'ping').sort((a, b) => b.createdAt - a.createdAt);
  const latest = written.find((n) => n.from !== backend.userId) ?? written[0];

  const send = async () => {
    const text = note.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await sendLoveNote(session, text);
      setNote('');
      bump();
      if (!reducedMotion) celebrate('hearts');
    } catch {
      showDialog('Mot doux non envoyé', 'Ton texte est conservé. Vérifie ta connexion et réessaie.');
    } finally { setBusy(false); }
  };

  return (
    <Card tone="soft" style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="caption" color={t.primaryDark}>
          Mot doux
        </T>
        {latest && (
          <T variant="small" muted>
            {nameOf(latest.from)} · {formatRelative(latest.createdAt)}
          </T>
        )}
      </Row>
      <T variant="quote">{latest ? quote(latest.text) : 'Pas encore de mot doux… et si tu commençais ?'}</T>
      <Row>
        <Field
          value={note}
          maxLength={4000}
          editable={!busy}
          onChangeText={setNote}
          placeholder={partner ? `Un petit mot pour ${partner.name}…` : 'Un petit mot…'}
          grow
          onSubmitEditing={send}
          returnKeyType="send"
          style={{ borderColor: 'transparent' }}
        />
        <IconButton icon="arrow-forward" label="Envoyer" variant="primary" onPress={send} size={50} />
      </Row>
      {written.length > 1 && (
        <Pressable onPress={() => setShowAll(!showAll)} hitSlop={8}>
          <T variant="small" color={t.primaryDark} style={{ fontFamily: Fonts.bodyBold }}>
            {showAll ? 'Masquer l’historique' : `Voir les ${written.length} mots doux`}
          </T>
        </Pressable>
      )}
      {showAll &&
        written.map((n) => (
          <Pressable key={n.id} onLongPress={backend.mode === 'local' || n.from === backend.userId ? () => confirmDelete(n.text, () => backend.remove('notes', n.id)) : undefined}>
            <Row style={{ alignItems: 'flex-start', gap: 10 }}>
              <View style={{ marginTop: 7 }}>
                <Dot color={colorOf(n.from)} />
              </View>
              <View style={{ flex: 1 }}>
                <T>{n.text}</T>
                <T variant="small" muted>
                  {nameOf(n.from)} · {formatRelative(n.createdAt)}
                </T>
              </View>
            </Row>
          </Pressable>
        ))}
    </Card>
  );
}
