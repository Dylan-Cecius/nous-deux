import { useEffect, useRef, useState } from 'react';
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
  Sheet,
  T,
} from '@/components/ui';
import { useAssistant } from '@/components/assistant-context';
import { showDialog } from '@/components/dialog';
import { TimeField } from '@/components/pickers';
import { cardShadow, Fonts, Spacing, useTheme } from '@/constants/theme';
import { notifyPartner } from '@/lib/assistant';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { endMin, freeSlots, fromMin, mondayOf, toMin } from '@/lib/agenda';
import { addDays, formatLong, fromKey, todayKey, weekdayShort } from '@/lib/dates';
import { BOTH, type AgendaEvent, type EventKind } from '@/lib/types';

const KINDS: { value: EventKind; label: string; icon: 'briefcase-outline' | 'person-outline' | 'heart-outline' }[] = [
  { value: 'travail', label: 'Travail', icon: 'briefcase-outline' },
  { value: 'perso', label: 'Perso', icon: 'person-outline' },
  { value: 'ensemble', label: 'Ensemble', icon: 'heart-outline' },
];

const HOUR_H = 40;

export default function Agenda() {
  const t = useTheme();
  const { backend, members, colorOf } = useSession();
  const eventState = useCollectionState('events');
  const unavailable = eventState.loading || eventState.error;
  const events = unavailable ? [] : eventState.items;
  const assistant = useAssistant();

  const [selected, setSelected] = useState(todayKey());
  const [weekStart, setWeekStart] = useState(mondayOf(todayKey()));
  const [editing, setEditing] = useState<AgendaEvent | 'new' | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const ofDay = events.filter((e) => e.date === selected).sort((a, b) => a.start.localeCompare(b.start));
  const free = members.length === 2 && ofDay.length > 0 ? freeSlots(ofDay) : [];
  const bestSlot = free.reduce<[number, number] | null>((best, s) => (!best || s[1] - s[0] > best[1] - best[0] ? s : best), null);

  // Plage affichée : 8h–22h par défaut, élargie pour contenir tous les horaires du jour.
  const startHour = Math.min(8, ...ofDay.map((e) => Math.floor(toMin(e.start) / 60)));
  const endHour = Math.max(22, ...ofDay.map((e) => Math.ceil(endMin(e) / 60)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const top = (min: number) => ((min - startHour * 60) / 60) * HOUR_H;
  const height = hours.length * HOUR_H;

  const columns = members.length > 0 ? members : [];
  const colIndex = (who: string) => columns.findIndex((m) => m.id === who);

  const shiftWeek = (delta: number) => {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    setSelected(next);
  };

  const monthLabel = fromKey(weekStart).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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
            const isToday = d === todayKey();
            const whos = [...new Set(events.filter((e) => e.date === d).map((e) => e.who))];
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={formatLong(d)}
                onPress={() => setSelected(d)}
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
            {fromKey(selected).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}
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
                    onLongPress={() => confirmDelete(e.title, () => backend.remove('events', e.id))}
                    style={{
                      position: 'absolute',
                      top: top(s) + 2,
                      height: h,
                      left: both ? 6 : col === 1 ? '50%' : 6,
                      right: both ? 6 : col === 1 ? 6 : '50%',
                      marginLeft: !both && col === 1 ? 3 : 0,
                      marginRight: !both && col !== 1 ? 3 : 0,
                      backgroundColor: colorOf(e.who),
                      borderRadius: 12,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      overflow: 'hidden',
                    }}>
                    <T variant="bodyBold" color="#fff" style={{ fontSize: 14 }} numberOfLines={h > 50 ? 2 : 1}>
                      {e.title}
                    </T>
                    {h > 44 && (
                      <T variant="small" color="rgba(255,255,255,0.85)" style={{ fontSize: 12 }}>
                        {e.start} – {e.end}
                      </T>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>}

        {!unavailable && ofDay.length === 0 && (
          <T muted style={{ textAlign: 'center' }}>
            Aucun horaire ce jour-là. Touchez + pour en ajouter.
          </T>
        )}
      </Screen>
      {!unavailable && <Fab onPress={() => setEditing('new')} label="Ajouter un horaire" />}

      {editing && (
        <EventSheet
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
  const seriesUnavailable = allEvents.loading || allEvents.error;
  // A native confirmation may outlive the snapshot, session or sheet that opened it.
  const latest = useRef<{ backend: typeof backend; state: typeof allEvents } | null>(null);
  useEffect(() => {
    latest.current = { backend, state: allEvents };
    return () => { latest.current = null; };
  }, [backend, allEvents]);
  const [title, setTitle] = useState(event?.title ?? '');
  const [who, setWho] = useState(event?.who ?? defaultWho);
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'travail');
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [start, setStart] = useState(event?.start ?? '09:00');
  const [end, setEnd] = useState(event?.end ?? '17:00');
  const [repeat, setRepeat] = useState('0');

  const valid = !!title.trim() && start < end;

  const save = async () => {
    if (!valid) return;
    const data = { title: title.trim(), who, kind, date, start, end, createdBy: event?.createdBy ?? backend.userId };
    if (event) {
      await backend.update('events', event.id, data);
    } else {
      const weeks = Number(repeat);
      const seriesId = weeks > 0 ? `${Date.now()}` : undefined;
      await backend.addEvents(Array.from({ length: Math.max(1, weeks) }, (_, i) => ({ ...data, date: addDays(date, i * 7), seriesId })));
      await notifyPartner(session, 'Agenda', `${session.me?.name ?? 'Ta moitié'} a ajouté « ${data.title} ».`);
    }
    onClose();
  };

  const removeSeries = () => {
    if (!event?.seriesId || seriesUnavailable) return;
    confirmDelete(`${event.title} (toutes les semaines à venir)`, async () => {
      const current = latest.current;
      if (!current) return;
      if (current.backend !== backend || current.state.loading || current.state.error) {
        showDialog('Agenda indisponible', 'Recharge les horaires avant de supprimer la série.');
        return;
      }
      const toRemove = current.state.items.filter((x) => x.seriesId === event.seriesId && x.date >= event.date);
      await backend.removeEvents(toRemove.map((x) => x.id));
      onClose();
    });
  };

  return (
    <Sheet visible title={event ? 'Modifier l’horaire' : 'Nouvel horaire'} onClose={onClose}>
      <Field label="Titre" value={title} maxLength={200} onChangeText={setTitle} placeholder="Boulot, sport, resto…" />
      <Chips
        label="Pour qui ?"
        options={[
          ...members.map((m) => ({ value: m.id, label: m.name, color: m.color })),
          { value: BOTH, label: 'Nous deux', icon: 'heart' as const },
        ]}
        value={who}
        onChange={setWho}
      />
      <Chips label="Type" options={KINDS} value={kind} onChange={setKind} />
      <View style={{ gap: 8 }}>
        <T variant="caption" muted>
          Jour
        </T>
        <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8 }}>
          <IconButton icon="chevron-back" label="Jour précédent" onPress={() => setDate(addDays(date, -1))} size={40} />
          <T variant="bodyBold" style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>
            {formatLong(date)}
          </T>
          <IconButton icon="chevron-forward" label="Jour suivant" onPress={() => setDate(addDays(date, 1))} size={40} />
        </Card>
      </View>
      <Row style={{ gap: Spacing.three }}>
        <TimeField label="Début" value={start} onChange={setStart} grow />
        <TimeField label="Fin" value={end} onChange={setEnd} grow />
      </Row>
      {start >= end && <T variant="small">L’heure de fin doit être après l’heure de début. Pour une nuit, ajoute un horaire sur chaque journée.</T>}
      {!event && <Chips label="Répéter chaque semaine" options={REPEATS} value={repeat} onChange={setRepeat} />}
      <Button label="Enregistrer" disabled={!valid} onPress={save} />
      {event && (
        <Button
          label="Supprimer"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirmDelete(event.title, async () => {
              await backend.remove('events', event.id);
              onClose();
            })
          }
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
          <Button label="Supprimer aussi les semaines suivantes" variant="danger" disabled={seriesUnavailable} onPress={removeSeries} />
        </>
      )}
    </Sheet>
  );
}
