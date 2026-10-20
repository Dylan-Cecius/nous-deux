import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { InvitationCard } from '@/components/invitation-card';
import { HomeHero } from '@/components/home/home-hero';
import { NoteCard, PingCard } from '@/components/home/love-cards';
import { MemoriesStrip } from '@/components/home/memories-strip';
import { QuestionCard } from '@/components/home/question-card';
import { DateField } from '@/components/pickers';
import { showDialog } from '@/components/dialog';
import { Button, Card, confirmDelete, Field, Ionicons, Row, Screen, SectionTitle, Sheet, T } from '@/components/ui';
import { cardShadow, useTheme } from '@/constants/theme';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { daysBetween, fromKey, nextOccurrence, todayKey } from '@/lib/dates';
import { useAsyncAction } from '@/lib/use-async-action';
import { useToday } from '@/lib/use-today';

export default function Home() {
  const { backend } = useSession();
  return <HomeContent key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function HomeContent() {
  const t = useTheme();
  const { backend, nameOf, colorOf } = useSession();
  const dates = useCollectionState('dates');
  const events = useCollectionState('events');
  const [dateOpen, setDateOpen] = useState(false);
  const context = useMemo(() => ({ backend }), [backend]);
  const latest = useRef<{ context: typeof context; dates: typeof dates } | null>(null);
  useEffect(() => {
    latest.current = { context, dates };
    return () => { latest.current = null; };
  }, [context, dates]);
  const { run: runDelete, pending: deleting } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => latest.current?.context === context;
  const canReadDates = () => isCurrent() && latest.current && !latest.current.dates.loading && !latest.current.dates.error;
  const canRemove = (id: string) => canReadDates() && latest.current!.dates.items.some((entry) => entry.id === id);
  const openDate = () => { if (canReadDates()) setDateOpen(true); };
  const removeDate = (id: string, title: string) => {
    if (deleting || !canRemove(id)) return;
    confirmDelete(title, () => runDelete(async () => {
      if (!canRemove(id)) return;
      try { await backend.remove('dates', id); }
      catch (error) { if (isCurrent()) throw error; }
    }));
  };

  const today = useToday();
  const todayEvents = events.items.filter((e) => e.date === today).sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = dates.items
    .map((d) => {
      const next = nextOccurrence(d.date, d.yearly);
      return { ...d, next, left: daysBetween(today, next) };
    })
    .filter((d) => d.left >= 0)
    .sort((a, b) => a.left - b.left);

  return (
    <Screen hero={<HomeHero />}>
      <InvitationCard />

      <PingCard />
      <NoteCard />
      <QuestionCard />

      {/* Aujourd'hui */}
      <SectionTitle title="Aujourd’hui" />
      <Card style={{ gap: 14 }}>
        {events.loading ? (
          <T muted>Chargement de l’agenda…</T>
        ) : events.error ? (
          <>
            <T>Agenda indisponible. Impossible de vérifier vos horaires pour le moment.</T>
            <Button label="Réessayer l’agenda" variant="outline" onPress={events.retry} />
          </>
        ) : todayEvents.length === 0 ? (
          <Row style={{ gap: 12 }}>
            <Ionicons name="sunny-outline" size={22} color={t.primary} />
            <T muted>Rien de prévu. Journée libre !</T>
          </Row>
        ) : (
          todayEvents.map((e) => (
            <Row key={e.id} style={{ gap: 12 }}>
              <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colorOf(e.who) }} />
              <View style={{ flex: 1 }}>
                <T variant="h3" numberOfLines={1}>
                  {e.title}
                </T>
                <T variant="small" muted>
                  {e.start} – {e.end} · {nameOf(e.who)}
                </T>
              </View>
            </Row>
          ))
        )}
      </Card>

      {/* Comptes à rebours */}
      <SectionTitle title="À venir" action={dates.loading || dates.error ? undefined : 'Ajouter'} onAction={openDate} />
      {dates.loading || dates.error ? (
        <Card>
          <T>{dates.loading ? 'Chargement des dates…' : 'Dates indisponibles. Impossible de charger vos comptes à rebours pour le moment.'}</T>
          {dates.error && <Button label="Réessayer les dates" variant="outline" onPress={dates.retry} />}
        </Card>
      ) : upcoming.length === 0 ? (
        <Card onPress={openDate}>
          <Row style={{ gap: 12 }}>
            <Ionicons name="hourglass-outline" size={22} color={t.primary} />
            <T muted style={{ flex: 1 }}>
              Vacances, anniversaire, concert… ajoutez les dates que vous attendez. Pour recevoir des rappels sur ton téléphone, active-les dans Nous → Notifications.
            </T>
          </Row>
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {upcoming.map((d) => (
            <Pressable
              key={d.id}
              disabled={deleting}
              accessibilityState={{ disabled: deleting }}
              onLongPress={() => removeDate(d.id, d.title)}
              style={[
                { width: '48.5%', flexGrow: 1, backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 4 },
                cardShadow(t.shadow),
              ]}>
              <T variant="title" color={t.primary}>
                {d.left === 0 ? 'Jour J' : `J-${d.left}`}
              </T>
              <T variant="h3" numberOfLines={2}>
                {d.title}
              </T>
              <T variant="small" muted>
                {fromKey(d.next).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
              </T>
            </Pressable>
          ))}
        </View>
      )}

      <MemoriesStrip />

      {dateOpen && <DateSheet onClose={() => setDateOpen(false)} />}
    </Screen>
  );
}

const PAST_DATE_MESSAGE = 'Choisis aujourd’hui ou une date future, ou active « Revient chaque année » pour un anniversaire.';

function DateSheet({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const { backend } = useSession();
  const collection = useCollectionState('dates');
  const context = useMemo(() => ({ backend }), [backend]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [yearly, setYearly] = useState(false);
  const latest = useRef<{ context: typeof context; collection: typeof collection; title: string; date: string; yearly: boolean } | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    latest.current = { context, collection, title, date, yearly };
    return () => { latest.current = null; };
  }, [context, collection, title, date, yearly]);
  const { run, pending } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => !closed.current && latest.current?.context === context;
  const unavailable = collection.loading || collection.error;
  const pastDate = !yearly && date < todayKey();
  const canWrite = () => isCurrent() && latest.current && !latest.current.collection.loading && !latest.current.collection.error;
  const close = () => { if (isCurrent()) { closed.current = true; onClose(); } };
  const change = (patch: Partial<{ title: string; date: string; yearly: boolean }>) => run(() => {
    const current = latest.current;
    if (!current || !isCurrent()) return;
    const next = { ...current, ...patch };
    latest.current = next;
    setTitle(next.title);
    setDate(next.date);
    setYearly(next.yearly);
  });
  const save = () => run(async () => {
    const current = latest.current;
    if (!current?.title.trim() || !canWrite()) return;
    if (!current.yearly && current.date < todayKey()) {
      showDialog('Date déjà passée', PAST_DATE_MESSAGE);
      return;
    }
    try {
      await backend.add('dates', { title: current.title.trim(), emoji: '', date: current.date, yearly: current.yearly });
      close();
    } catch (error) { if (isCurrent()) throw error; }
  });

  return (
    <Sheet visible title="Nouvelle date" onClose={() => run(close)}>
      <Field label="Quoi ?" value={title} maxLength={200} editable={!pending} onChangeText={(value) => change({ title: value })} placeholder="Nos vacances en Italie" />
      <DateField label="Date" value={date} disabled={pending} onChange={(value) => change({ date: value })} />
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="bodyBold">Revient chaque année</T>
          <T variant="small" muted>
            Anniversaires, date de rencontre…
          </T>
        </View>
        <Switch value={yearly} disabled={pending} accessibilityLabel="Revient chaque année" onValueChange={(value) => change({ yearly: value })} trackColor={{ true: t.primary }} />
      </Row>
      {pastDate && <T variant="small">{PAST_DATE_MESSAGE}</T>}
      {unavailable && <T variant="small" muted>Dates indisponibles. Ton brouillon est conservé ; recharge les dates avant de continuer.</T>}
      {collection.error && <Button label="Recharger les dates du formulaire" variant="outline" onPress={collection.retry} />}
      <Button
        label="Ajouter"
        disabled={pending || unavailable || pastDate || !title.trim()}
        onPress={save}
      />
    </Sheet>
  );
}
