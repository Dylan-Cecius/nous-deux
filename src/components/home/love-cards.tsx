import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { celebrate } from '@/components/celebrate';
import { showDialog } from '@/components/dialog';
import { Button, Card, confirmDelete, Dot, Field, IconButton, Ionicons, Row, T } from '@/components/ui';
import { cardShadow, Fonts, useTheme } from '@/constants/theme';
import { sendLoveNote } from '@/lib/assistant';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { formatRelative, quote } from '@/lib/dates';
import { bump, success } from '@/lib/haptics';
import { useAsyncAction } from '@/lib/use-async-action';

/** Bouton « Je pense à toi » : un appui envoie un cœur et une notification à ta moitié. */
export function PingCard() {
  const { backend } = useSession();
  return <ScopedPingCard key={JSON.stringify([backend.mode, backend.coupleId, backend.userId])} />;
}

function ScopedPingCard() {
  const t = useTheme();
  const session = useSession();
  const { backend, partner } = session;
  const notes = useCollectionState('notes');
  const beat = useState(() => new Animated.Value(1))[0];
  const [sent, setSent] = useState(false);
  const partnerId = partner?.id;
  const context = useMemo(() => ({ backend, partnerId }), [backend, partnerId]);
  const latest = useRef<{ context: typeof context; sent: boolean } | null>(null);
  useEffect(() => {
    latest.current = { context, sent };
    return () => { latest.current = null; };
  }, [context, sent]);
  const isCurrent = () => latest.current?.context === context;
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), 2500);
    return () => clearTimeout(timer);
  }, [sent]);

  // Le cœur bat doucement en continu.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1.18, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1.12, duration: 160, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [beat]);

  const lastReceived = notes.items
    .filter((n) => n.kind === 'ping' && n.from !== backend.userId)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  const { run: ping, pending } = useAsyncAction(async () => {
    if (!isCurrent() || latest.current?.sent || (backend.mode === 'cloud' && !partnerId)) return;
    try {
      await sendLoveNote(session, '💗', 'ping', isCurrent);
      if (!isCurrent() || !latest.current) return;
      latest.current.sent = true;
      success();
      celebrate('hearts');
      setSent(true);
    } catch {
      if (isCurrent()) showDialog('Enregistrement non confirmé', 'Le cœur a peut-être été enregistré, mais sa confirmation n’a pas été reçue. Évite de le renvoyer immédiatement.');
    }

  });
  const waitingForPartner = backend.mode === 'cloud' && !partner;

  return (
    <View style={{ gap: 8 }}>
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
            {waitingForPartner ? 'Invite ta moitié pour lui envoyer un petit cœur.' : notes.loading ? 'Chargement des cœurs reçus…' : notes.error ? 'Historique des cœurs indisponible' : backend.mode === 'local' ? 'Un petit cœur conservé sur ce téléphone.' : lastReceived && partner
              ? `${partner.name} a pensé à toi ${formatRelative(lastReceived.createdAt)}`
              : `Un appui, et ${partner?.name ?? 'ta moitié'} reçoit un petit cœur`}
          </T>
        </View>
        <Ionicons name="paper-plane-outline" size={20} color={t.primary} />
      </Pressable>
      {notes.error && <Button label="Réessayer les cœurs reçus" variant="outline" onPress={notes.retry} />}
    </View>
  );
}

/** Dernier mot doux reçu, champ pour en écrire un, historique. */
export function NoteCard() {
  const { backend } = useSession();
  return <ScopedNoteCard key={JSON.stringify([backend.mode, backend.coupleId, backend.userId])} />;
}

function ScopedNoteCard() {
  const t = useTheme();
  const session = useSession();
  const { backend, partner, nameOf, colorOf } = session;
  const notes = useCollectionState('notes');
  const [note, setNote] = useState('');
  const [showAll, setShowAll] = useState(false);
  const partnerId = partner?.id;
  const context = useMemo(() => ({ backend, partnerId }), [backend, partnerId]);
  const latestDraft = useRef<{ context: typeof context; note: string } | null>(null);
  useEffect(() => {
    latestDraft.current = { context, note };
    return () => { latestDraft.current = null; };
  }, [context, note]);
  const isCurrent = () => latestDraft.current?.context === context;

  const written = notes.loading || notes.error ? [] : notes.items.filter((n) => n.kind !== 'ping').sort((a, b) => b.createdAt - a.createdAt);
  const latest = written.find((n) => n.from !== backend.userId) ?? written[0];

  const { run: send, pending: busy } = useAsyncAction(async () => {
    if (!isCurrent()) return;
    const text = latestDraft.current?.note.trim() ?? '';
    if (!text || text.length > 4000) return;
    try {
      await sendLoveNote(session, text, 'note', isCurrent);
      if (!isCurrent()) return;
      setNote('');
      bump();
      celebrate('hearts');
    } catch {
      if (isCurrent()) showDialog('Enregistrement non confirmé', 'Ton texte est conservé. Recharge les mots doux pour vérifier si le message a été enregistré avant de réessayer.');
    }
  });

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
      {notes.loading ? (
        <T muted>Chargement des mots doux…</T>
      ) : notes.error ? (
        <>
          <T>Mots doux indisponibles. Impossible de charger votre historique pour le moment.</T>
          <Button label="Réessayer les mots doux" variant="outline" onPress={notes.retry} />
        </>
      ) : (
        <T variant="quote">{latest ? quote(latest.text) : 'Pas encore de mot doux… et si tu commençais ?'}</T>
      )}
      <Row>
        <Field
          value={note}
          maxLength={4000}
          editable={!busy}
          onChangeText={(value) => { if (isCurrent() && !busy) setNote(value); }}
          placeholder={partner ? `Un petit mot pour ${partner.name}…` : 'Un petit mot…'}
          grow
          onSubmitEditing={send}
          returnKeyType="send"
          style={{ borderColor: 'transparent' }}
        />
        <IconButton icon="arrow-forward" label="Envoyer" variant="primary" onPress={send} disabled={busy || !note.trim()} size={50} />
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
