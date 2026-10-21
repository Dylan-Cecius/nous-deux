import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Button,
  Card,
  Chips,
  confirmDelete,
  Dot,
  Fab,
  Field,
  IconButton,
  Ionicons,
  Row,
  Screen,
  SectionTitle,
  Sheet,
  T,
} from '@/components/ui';
import { useAssistant } from '@/components/assistant-context';
import { showDialog } from '@/components/dialog';
import { TimeField } from '@/components/pickers';
import { cardShadow, Fonts, Spacing, useTheme } from '@/constants/theme';
import { notifyPartner } from '@/lib/assistant';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { foregroundOnColor } from '@/lib/color-contrast';
import { endMin, freeSlots, fromMin, mondayOf, toMin } from '@/lib/agenda';
import { addDays, formatLong, fromKey, todayKey, weekdayShort } from '@/lib/dates';
import { BOTH, type AgendaEvent, type EventKind } from '@/lib/types';
import { useAsyncAction } from '@/lib/use-async-action';
import { draftPatch, useSharedDraft } from '@/lib/use-shared-draft';
import { useToday } from '@/lib/use-today';

const KINDS: { value: EventKind; label: string; icon: 'briefcase-outline' | 'person-outline' | 'heart-outline' }[] = [
  { value: 'travail', label: 'Travail', icon: 'briefcase-outline' },
  { value: 'perso', label: 'Perso', icon: 'person-outline' },
  { value: 'ensemble', label: 'Ensemble', icon: 'heart-outline' },
];

const HOUR_H = 40;

export default function Agenda() {
  const { backend } = useSession();
  return <AgendaContent key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function AgendaContent() {
  const t = useTheme();
  const today = useToday();
  const { backend, members, colorOf, nameOf } = useSession();
  const eventState = useCollectionState('events');
  const context = useMemo(() => ({ backend }), [backend]);
  const latest = useRef<{ context: typeof context; state: typeof eventState } | null>(null);
  useEffect(() => {
    latest.current = { context, state: eventState };
    return () => { latest.current = null; };
  }, [context, eventState]);
  const { run: runDelete } = useAsyncAction((action: () => Promise<void>) => action());
  const unavailable = eventState.loading || eventState.error;
  const events = unavailable ? [] : eventState.items;
  const assistant = useAssistant();

  const [{ selected, weekStart }, setNavigation] = useState(() => {
    const day = todayKey();
    return { selected: day, weekStart: mondayOf(day) };
  });
  const [editing, setEditing] = useState<AgendaEvent | 'new' | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const ofDay = events.filter((e) => e.date === selected).sort((a, b) => a.start.localeCompare(b.start));
  const free = members.length === 2 && ofDay.length > 0 ? freeSlots(ofDay) : [];
  const bestSlot = free.reduce<[number, number] | null>((best, s) => (!best || s[1] - s[0] > best[1] - best[0] ? s : best), null);

  // Plage affichée : 8h–22h par défaut, élargie pour les horaires et plages libres.
  const startHour = Math.min(8, ...ofDay.map((e) => Math.floor(toMin(e.start) / 60)));
  const endHour = Math.max(22, ...ofDay.map((e) => Math.ceil(endMin(e) / 60)), ...free.map(([, end]) => Math.ceil(end / 60)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const top = (min: number) => ((min - startHour * 60) / 60) * HOUR_H;
  const height = hours.length * HOUR_H;

  const columns = members.length > 0 ? members : [];
  const colIndex = (who: string) => columns.findIndex((m) => m.id === who);

  const shiftWeek = (delta: number) => {
    setNavigation(previous => {
      const next = addDays(previous.weekStart, delta * 7);
      return { weekStart: next, selected: next };
    });
  };

  const returnToToday = () => {
    const currentDay = todayKey();
    setNavigation({ weekStart: mondayOf(currentDay), selected: currentDay });
  };

  const askRemove = (event: AgendaEvent) => {
    if (latest.current?.context !== context) return;
    confirmDelete(event.title, () => runDelete(async () => {
      const current = latest.current;
      if (!current || current.context !== context) return;
      if (current.state.loading || current.state.error) {
        showDialog('Agenda indisponible', 'Recharge les horaires avant de supprimer cet horaire.');
        return;
      }
      if (!current.state.items.some((item) => item.id === event.id)) return;
      try { await backend.remove('events', event.id); }
      catch (error) { if (latest.current?.context === context) throw error; }
    }));
  };

  const monthStart = fromKey(weekStart).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const monthEnd = fromKey(days[6]).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const monthLabel = monthStart === monthEnd ? monthStart : `${monthStart} – ${monthEnd}`;

  return (
    <>
      <Screen
        overline={monthLabel}
        title="Agenda"
        right={
          <Row>
            <IconButton icon="chevron-back" label="Semaine précédente" onPress={() => shiftWeek(-1)} />
            <IconButton icon="chevron-forward" label="Semaine suivante" onPress={() => shiftWeek(1)} />
          </Row>
        }>
        {/* Semaine */}
        <View style={[{ flexDirection: 'row', backgroundColor: t.card, borderRadius: 22, padding: 6, gap: 4 }, cardShadow(t.shadow)]}>
          {days.map((d) => {
            const active = d === selected;
            const isToday = d === today;
            const whos = [...new Set(events.filter((e) => e.date === d).map((e) => e.who))];
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={formatLong(d)}
                onPress={() => setNavigation(previous => (
                  d < previous.weekStart || d > addDays(previous.weekStart, 6)
                    ? previous : { ...previous, selected: d }
                ))}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderRadius: 16,
                  gap: 4,
                  backgroundColor: active ? t.feature : 'transparent',
                }}>
                <T variant="caption" color={active ? t.onFeatureMuted : t.textSecondary} style={{ fontSize: 10, letterSpacing: 0.8 }}>
                  {weekdayShort(d)}
                </T>
                <T
                  variant="bodyBold"
                  color={active ? t.onFeature : isToday ? t.primary : t.text}
                  style={{ fontSize: 17 }}>
                  {fromKey(d).getDate()}
                </T>
                <View style={{ flexDirection: 'row', gap: 3, height: 5 }}>
                  {whos.slice(0, 3).map((w) => (
                    <Dot key={w} size={5} color={colorOf(w)} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        {selected !== today && (
          <Button label="Revenir à aujourd’hui" variant="ghost" small onPress={returnToToday} />
        )}

        {assistant && (
          <Button
            label="Importer mon planning en photo"
            icon="camera-outline"
            variant="outline"
            small
            onPress={() => assistant.open('schedule')}
          />
        )}

        {/* Jour sélectionné */}
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <T variant="h2" style={{ textTransform: 'capitalize' }}>
            {formatLong(selected, true)}
          </T>
          {bestSlot && (
            <Row style={{ backgroundColor: t.successSoft, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, gap: 6 }}>
              <Ionicons name="heart" size={14} color={t.success} />
              <T variant="small" color={t.success} style={{ fontFamily: Fonts.bodyBold }}>
                Libres ensemble {fromMin(bestSlot[0])} – {fromMin(bestSlot[1])}
              </T>
            </Row>
          )}
        </Row>

        {/* Colonnes par personne */}
        {unavailable && (
          <Card>
            <T>{eventState.loading ? 'Chargement de l’agenda…' : 'Agenda indisponible. Impossible de vérifier vos horaires pour le moment.'}</T>
            {eventState.error && <Button label="Réessayer l’agenda" variant="outline" onPress={eventState.retry} />}
          </Card>
        )}
        {!unavailable && <View>
          <View style={{ flexDirection: 'row', marginLeft: 48, gap: 8, marginBottom: 10 }}>
            {columns.map((m) => (
              <Row key={m.id} style={{ flex: 1, gap: 6 }}>
                <Dot color={m.color} />
                <T variant="bodyBold" style={{ fontSize: 14 }} numberOfLines={1}>
                  {m.name}
                </T>
              </Row>
            ))}
          </View>

          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 48 }}>
              {hours.map((h) => (
                <View key={h} style={{ height: HOUR_H }}>
                  <T variant="small" muted style={{ fontSize: 11, textAlign: 'right', paddingRight: 8, marginTop: -7 }}>
                    {h}:00
                  </T>
                </View>
              ))}
            </View>

            <View style={[{ flex: 1, height, borderRadius: 18, backgroundColor: t.card, overflow: 'hidden' }, cardShadow(t.shadow)]}>
              {hours.map((h, i) => (
                <View
                  key={h}
                  style={{ position: 'absolute', left: 0, right: 0, top: i * HOUR_H, height: 1, backgroundColor: t.line }}
                />
              ))}

              {free.map(([s, e]) => (
                <View
                  key={s}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: top(s),
                    height: top(e) - top(s),
                    backgroundColor: t.successSoft,
                  }}
                />
              ))}

              {ofDay.map((e) => {
                const background = colorOf(e.who);
                const foreground = foregroundOnColor(background);
                const both = e.who === BOTH || columns.length < 2;
                const col = colIndex(e.who);
                const s = toMin(e.start);
                const h = Math.max(top(endMin(e)) - top(s) - 4, 30);
                return (
                  <Pressable
                    key={e.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${e.title}, ${e.start} à ${e.end}`}
                    onPress={() => setEditing(e)}
                    onLongPress={() => askRemove(e)}
                    style={{
                      position: 'absolute',
                      top: top(s) + 2,
                      height: h,
                      left: both ? 6 : col === 1 ? '50%' : 6,
                      right: both ? 6 : col === 1 ? 6 : '50%',
                      marginLeft: !both && col === 1 ? 3 : 0,
                      marginRight: !both && col !== 1 ? 3 : 0,
                      backgroundColor: background,
                      borderRadius: 12,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      overflow: 'hidden',
                    }}>
                    <T variant="bodyBold" color={foreground} style={{ fontSize: 14 }} numberOfLines={h > 50 ? 2 : 1}>
                      {e.title}
                    </T>
                    {h > 44 && (
                      <T variant="small" color={foreground} style={{ fontSize: 12 }}>
                        {e.start} – {e.end}
                      </T>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>}

        {!unavailable && ofDay.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionTitle title="Détail des horaires" />
            {ofDay.map(e => (
              <Card
                key={e.id}
                onPress={() => setEditing(e)}
                accessibilityLabel={`${e.title}, ${e.start} à ${e.end}, ${nameOf(e.who)}`}
                accessibilityHint="Ouvre la fiche de cet horaire.">
                <T variant="h3">{e.title}</T>
                <T variant="small" muted>{e.start} – {e.end} · {nameOf(e.who)}</T>
              </Card>
            ))}
          </View>
        )}

        {!unavailable && ofDay.length === 0 && (
          <T muted style={{ textAlign: 'center' }}>
            Aucun horaire ce jour-là. Touchez + pour en ajouter.
          </T>
        )}
      </Screen>
      {!unavailable && <Fab onPress={() => setEditing('new')} label="Ajouter un horaire" />}

      {editing && (
        <EventSheet
          key={editing === 'new' ? 'new' : editing.id}
          event={editing === 'new' ? undefined : editing}
          defaultDate={selected}
          defaultWho={backend.userId}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

const REPEATS = [
  { value: '0', label: 'Une fois' },
  { value: '4', label: '4 semaines' },
  { value: '8', label: '8 semaines' },
  { value: '12', label: '12 semaines' },
];

function eventFields(event: AgendaEvent | undefined, defaultDate: string, defaultWho: string) {
  return {
    title: event?.title ?? '', who: event?.who ?? defaultWho,
    kind: event?.kind ?? 'travail' as EventKind, date: event?.date ?? defaultDate,
    start: event?.start ?? '09:00', end: event?.end ?? '17:00',
  };
}

function EventSheet({
  event,
  defaultDate,
  defaultWho,
  onClose,
}: {
  event?: AgendaEvent;
  defaultDate: string;
  defaultWho: string;
  onClose: () => void;
}) {
  const session = useSession();
  const { backend, members } = session;
  const allEvents = useCollectionState('events');
  const received = !allEvents.loading && !allEvents.error && event
    ? allEvents.items.find((entry) => entry.id === event.id) : undefined;
  const { base, values, setValues: setRenderedValues } = useSharedDraft(
    eventFields(event, defaultDate, defaultWho), received ? eventFields(received, defaultDate, defaultWho) : null,
  );
  const { title, who, kind, date, start, end } = values;
  const setTitle = (title: string) => setValues((previous) => ({ ...previous, title }));
  const setWho = (who: string) => setValues((previous) => ({ ...previous, who }));
  const setKind = (kind: EventKind) => setValues((previous) => ({ ...previous, kind }));
  const setStart = (start: string) => setValues((previous) => ({ ...previous, start }));
  const setEnd = (end: string) => setValues((previous) => ({ ...previous, end }));
  const shiftDate = (days: number) => setValues((previous) => ({ ...previous, date: addDays(previous.date, days) }));
  const [repeat, setRenderedRepeat] = useState('0');
  const unavailable = allEvents.loading || allEvents.error || (!!event && !allEvents.items.some((entry) => entry.id === event.id));
  // A native confirmation may outlive the snapshot, session or sheet that opened it.
  const context = useMemo(() => ({ backend }), [backend]);
  const latest = useRef<{ context: typeof context; state: typeof allEvents; base: typeof base; values: typeof values; repeat: string; members: typeof members } | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    latest.current = { context, state: allEvents, base, values, repeat, members };
    return () => { latest.current = null; };
  }, [context, allEvents, base, values, repeat, members]);
  const { run, pending: busy } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => !closed.current && latest.current?.context === context;
  const setValues = (update: (previous: typeof values) => typeof values) => {
    const current = latest.current;
    if (!current || !isCurrent()) return;
    const next = update(current.values);
    current.values = next;
    setRenderedValues(() => next);
  };
  const setRepeat = (next: string) => {
    if (!latest.current || !isCurrent()) return;
    latest.current.repeat = next;
    setRenderedRepeat(next);
  };
  const canWrite = () => {
    const state = latest.current?.state;
    return isCurrent() && state && !state.loading && !state.error && (!event || state.items.some((entry) => entry.id === event.id));
  };
  const close = () => { if (isCurrent()) { closed.current = true; onClose(); } };
  const runCurrent = (action: () => Promise<void>) => run(async () => {
    if (!canWrite()) return;
    try { await action(); }
    catch (error) { if (isCurrent()) throw error; }
  });

  const validWho = who === BOTH || members.some((member) => member.id === who);
  const valid = !!title.trim() && start < end && validWho;

  const save = () => runCurrent(async () => {
    const current = latest.current!;
    const { title, who, kind, date, start, end } = current.values;
    if (!title.trim() || start >= end || (who !== BOTH && !current.members.some((member) => member.id === who))) return;
    const data = { title: title.trim(), who, kind, date, start, end };
    if (event) {
      const patch = draftPatch(current.base, data);
      if (Object.keys(patch).length) await backend.update('events', event.id, patch);
    } else {
      const weeks = Number(current.repeat);
      const seriesId = weeks > 0 ? `${Date.now()}` : undefined;
      await backend.addEvents(Array.from({ length: Math.max(1, weeks) }, (_, i) => ({ ...data, date: addDays(date, i * 7), seriesId, createdBy: backend.userId })));
      if (!isCurrent()) return;
      await notifyPartner(session, 'Agenda', `${session.me?.name ?? 'Ta moitié'} a ajouté « ${data.title} ».`);
    }
    close();
  });

  const removeOne = () => {
    if (!event || busy || !canWrite()) return;
    confirmDelete(event.title, () => runCurrent(async () => {
      await backend.remove('events', event.id);
      close();
    }));
  };

  const removeSeries = () => {
    if (!event?.seriesId || busy || !canWrite()) return;
    confirmDelete(`${event.title} (toutes les semaines à venir)`, () => run(async () => {
      const current = latest.current;
      if (!current || closed.current) return;
      const anchor = current.state.items.find((entry) => entry.id === event.id);
      if (!isCurrent() || current.state.loading || current.state.error || !anchor || anchor.seriesId !== event.seriesId || anchor.date !== event.date) {
        showDialog('Agenda indisponible', 'Recharge les horaires avant de supprimer la série.');
        return;
      }
      const toRemove = current.state.items.filter((x) => x.seriesId === event.seriesId && x.date >= event.date);
      try {
        await backend.removeEvents(toRemove.map((x) => x.id));
        close();
      } catch (error) { if (isCurrent()) throw error; }
    }));
  };

  return (
    <Sheet visible title={event ? 'Modifier l’horaire' : 'Nouvel horaire'} onClose={() => run(close)}>
      <Field label="Titre" value={title} maxLength={200} editable={!busy} onChangeText={(value) => run(() => { if (isCurrent()) setTitle(value); })} placeholder="Boulot, sport, resto…" />
      <Chips
        label="Pour qui ?"
        options={[
          ...members.map((m) => ({ value: m.id, label: m.name, color: m.color })),
          { value: BOTH, label: 'Nous deux', icon: 'heart' as const },
        ]}
        value={who}
        disabled={busy}
        onChange={(value) => run(() => { if (isCurrent()) setWho(value); })}
      />
      {!validWho && <T variant="small">Ce membre n’est plus disponible. Choisis à qui attribuer cet horaire ; ta saisie est conservée.</T>}
      <Chips label="Type" options={KINDS} value={kind} disabled={busy} onChange={(value) => run(() => { if (isCurrent()) setKind(value); })} />
      <View style={{ gap: 8 }}>
        <T variant="caption" muted>
          Jour
        </T>
        <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8 }}>
          <IconButton icon="chevron-back" label="Jour précédent" disabled={busy} onPress={() => run(() => { if (isCurrent()) shiftDate(-1); })} size={40} />
          <T variant="bodyBold" style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>
            {formatLong(date, true)}
          </T>
          <IconButton icon="chevron-forward" label="Jour suivant" disabled={busy} onPress={() => run(() => { if (isCurrent()) shiftDate(1); })} size={40} />
        </Card>
      </View>
      <Row style={{ gap: Spacing.three }}>
        <TimeField label="Début" value={start} disabled={busy} onChange={(value) => run(() => { if (isCurrent()) setStart(value); })} grow />
        <TimeField label="Fin" value={end} disabled={busy} onChange={(value) => run(() => { if (isCurrent()) setEnd(value); })} grow />
      </Row>
      {start >= end && <T variant="small">L’heure de fin doit être après l’heure de début. Pour une nuit, ajoute un horaire sur chaque journée.</T>}
      {!event && <Chips label="Répéter chaque semaine" options={REPEATS} value={repeat} disabled={busy} onChange={(value) => run(() => { if (isCurrent()) setRepeat(value); })} />}
      {unavailable && <T variant="small" muted>Agenda indisponible ou horaire retiré. Ton brouillon est conservé ; recharge les horaires avant de continuer.</T>}
      {allEvents.error && !event?.seriesId && <Button label="Recharger l’agenda du formulaire" variant="outline" onPress={allEvents.retry} />}
      <Button label="Enregistrer" disabled={!valid || busy || unavailable} onPress={save} />
      {event && (
        <Button
          label="Supprimer"
          variant="danger"
          icon="trash-outline"
          disabled={busy || unavailable}
          onPress={removeOne}
        />
      )}
      {!!event?.seriesId && (
        <>
          {allEvents.loading && <T variant="small" muted>Chargement de la série…</T>}
          {allEvents.error && (
            <>
              <T variant="small" muted>Série indisponible. Recharge les horaires avant de supprimer les semaines suivantes.</T>
              <Button label="Réessayer la série" variant="outline" onPress={allEvents.retry} />
            </>
          )}
          <Button label="Supprimer aussi les semaines suivantes" variant="danger" disabled={unavailable || busy} onPress={removeSeries} />
        </>
      )}
    </Sheet>
  );
}
