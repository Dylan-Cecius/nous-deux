import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Chips, Field, Sheet, T } from './ui';
import { DateField } from './pickers';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { formatLong } from '@/lib/dates';
import { MAX_SCHEDULE_TEXT, newScheduleSlots, parseSchedule } from '@/lib/schedule-import';
import { readSchedulePhoto } from '@/lib/schedule-photo';
import { useAsyncAction } from '@/lib/use-async-action';

export function ScheduleImport({ defaultDate, onClose }: { defaultDate: string; onClose: () => void }) {
  const { backend, members } = useSession();
  const state = useCollectionState('events');
  const [text, setText] = useState('');
  const [reference, setReference] = useState(defaultDate);
  const [who, setWho] = useState(backend.userId);
  const [reviewed, setReviewed] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const context = useMemo(() => ({ backend }), [backend]);
  const latest = useRef<{ context: typeof context; state: typeof state; members: typeof members } | null>(null);
  const closed = useRef(false);
  const attempted = useRef(false);
  const revision = useRef(0);
  const renderedRevision = revision.current;
  const { run, pending } = useAsyncAction((action: () => unknown) => action());
  useEffect(() => {
    latest.current = { context, state, members };
    return () => { latest.current = null; };
  }, [context, state, members]);
  const current = () => !closed.current && latest.current?.context === context;
  const close = () => { if (current()) { closed.current = true; onClose(); } };
  const parsed = useMemo(() => parseSchedule(text, reference), [text, reference]);
  const fresh = newScheduleSlots(parsed.slots, state.items, who);
  const unavailable = state.loading || state.error;
  const disabled = pending || uncertain;
  const change = (action: () => void) => run(() => { if (current() && !attempted.current) { revision.current++; setReviewed(false); setMessage(''); action(); } });
  const scan = (camera: boolean) => run(async () => {
    if (!current() || uncertain) return;
    try {
      const result = await readSchedulePhoto(camera);
      if (current() && result !== null) { revision.current++; setText(result); setReviewed(false); setMessage(''); }
    } catch (error) { if (current()) throw error; }
  });
  const save = () => run(async () => {
    const now = latest.current;
    if (!current() || !now || attempted.current || revision.current !== renderedRevision || !reviewed || now.state.loading || now.state.error || !now.members.some(m => m.id === who)) return;
    const result = parseSchedule(text, reference);
    if (result.issues.length || !result.slots.length || result.slots.length > 52) return;
    const toAdd = newScheduleSlots(result.slots, now.state.items, who);
    if (!toAdd.length) { setMessage('Ces créneaux sont déjà présents pour cette personne.'); return; }
    attempted.current = true;
    try {
      await backend.addEvents(toAdd.map(slot => ({ ...slot, title: 'Travail', kind: 'travail', who, createdBy: backend.userId })));
      if (current()) close();
    } catch {
      if (current()) {
        setUncertain(true);
        setMessage('Enregistrement non confirmé. Ferme cette fenêtre et vérifie l’agenda après actualisation avant un nouvel import : les horaires peuvent déjà avoir été ajoutés.');
      }
    }
  });
  return <Sheet visible title="Importer un planning" onClose={() => run(close)}>
    <T>Recadre la feuille sur les horaires d’une seule personne. La reconnaissance se fait sur l’appareil ; la photo et son texte ne sont pas envoyés à un service IA.</T>
    <T variant="small" muted>{backend.mode === 'cloud'
      ? 'Les créneaux confirmés seront visibles par les deux membres de cet espace.'
      : 'Mode local : les créneaux resteront sur ce téléphone, sans partage entre appareils.'}</T>
    <Button label="Photographier le planning" icon="camera-outline" variant="outline" disabled={disabled} onPress={() => scan(true)} />
    <Button label="Choisir une photo du planning" icon="image-outline" variant="outline" disabled={disabled} onPress={() => scan(false)} />
    <Chips label="Horaires de" value={who} disabled={disabled} options={members.map(m => ({ value: m.id, label: m.name, color: m.color }))} onChange={value => change(() => setWho(value))} />
    <DateField label="Semaine et année de référence" value={reference} disabled={disabled} onChange={value => change(() => setReference(value))} />
    <T variant="small" muted>Les jours seuls utilisent la semaine choisie ; les dates sans année utilisent son année. Vérifie chaque date. Pour un tableau à plusieurs colonnes, remets les heures sur la même ligne que leur date.</T>
    <Field label="Texte du planning à corriger" value={text} multiline editable={!disabled} onChangeText={value => change(() => setText(value))} placeholder={'Lundi 09h00-12h00 13h00-17h00\n03/11/2026 10:00-18:00'} />
    {text.length > MAX_SCHEDULE_TEXT && <T>Réduis le texte à {MAX_SCHEDULE_TEXT} caractères maximum.</T>}
    {parsed.issues.map((issue, i) => <T key={i} variant="small">{issue}</T>)}
    {!!parsed.slots.length && <Card>
      <T variant="h3">Créneaux à vérifier ({parsed.slots.length})</T>
      {parsed.slots.slice(0, 52).map(slot => <T key={`${slot.date}/${slot.start}/${slot.end}`} variant="small">{formatLong(slot.date)} {slot.date.slice(0, 4)} · {slot.start} – {slot.end}</T>)}
      {!unavailable && <T variant="small">{parsed.slots.length - fresh.length} créneau(x) déjà présent(s), ignoré(s).</T>}
    </Card>}
    {!parsed.slots.length && !!text.trim() && !parsed.issues.length && <T>Aucun créneau de travail détecté.</T>}
    <Button label={reviewed ? 'Dates, heures et personne vérifiées' : 'Je confirme les dates, heures et la personne'} variant="outline" disabled={disabled || !!parsed.issues.length || !parsed.slots.length} onPress={() => change(() => setReviewed(!reviewed))} />
    {unavailable && <T>Recharge l’agenda avant d’importer les horaires.</T>}
    {state.error && <Button label="Recharger l’agenda" variant="outline" disabled={pending} onPress={state.retry} />}
    {!!message && <T>{message}</T>}
    <Button label={`Ajouter ${fresh.length} créneau(x)`} disabled={disabled || unavailable || !reviewed || !!parsed.issues.length || !fresh.length || !members.some(m => m.id === who)} onPress={save} />
    <Button label="Fermer l’import" variant="ghost" disabled={pending} onPress={() => run(close)} />
  </Sheet>;
}
