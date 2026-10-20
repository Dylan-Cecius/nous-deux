import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_FRAME, PhotoFrameEditor } from '@/components/framed-photo';
import { DateField } from '@/components/pickers';
import { Button, Sheet, T } from '@/components/ui';

import { useSession } from '@/lib/couple-context';
import { todayKey } from '@/lib/dates';
import { pickPhoto } from '@/lib/photos';
import { useAsyncAction } from '@/lib/use-async-action';
import { useSharedDraft } from '@/lib/use-shared-draft';

/** Réglages de la carte « Ensemble depuis » : date de rencontre et photo de couple. */
export function CounterSheet({ onClose }: { onClose: () => void }) {
  const { backend } = useSession();
  return <CounterForm key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} onClose={onClose} />;
}

function CounterForm({ onClose }: { onClose: () => void }) {
  const { backend, couple } = useSession();
  const { values, setValues } = useSharedDraft(
    { since: couple?.since ?? todayKey() },
    couple ? { since: couple.since ?? todayKey() } : null,
  );
  const value = values.since;
  const [frame, setFrame] = useState(couple?.photoFrame ?? DEFAULT_FRAME);
  const [framing, setFraming] = useState<{ uri: string } | null>(null);
  const context = useMemo(() => ({ backend }), [backend]);
  const latest = useRef<{ context: typeof context; couple: typeof couple; framing: typeof framing; value: string; frame: typeof frame } | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    latest.current = { context, couple, framing, value, frame };
    return () => { latest.current = null; };
  }, [context, couple, framing, value, frame]);
  const { run, pending: busy } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => !closed.current && latest.current?.context === context;
  const canWrite = () => isCurrent() && !!latest.current?.couple;
  const changeFraming = (next: typeof framing, nextFrame = latest.current?.frame ?? frame) => {
    if (!latest.current) return;
    latest.current.framing = next;
    latest.current.frame = nextFrame;
    setFrame(nextFrame);
    setFraming(next);
  };
  const close = () => { if (isCurrent()) { closed.current = true; onClose(); } };
  const runCurrent = (action: () => Promise<void>) => run(async () => {
    if (!canWrite()) return;
    try { await action(); }
    catch (error) { if (isCurrent()) throw error; }
  });

  const changePhoto = () => runCurrent(async () => {
    if (latest.current?.framing !== null) return;
    const picked = await pickPhoto();
    if (!picked || !canWrite()) return;
    const photoUrl = await backend.uploadPhoto(picked.uri);
    if (!canWrite()) return;
    await backend.updateCouple({ photoUrl, photoFrame: DEFAULT_FRAME });
    if (!isCurrent()) return;
    changeFraming({ uri: photoUrl }, DEFAULT_FRAME);
  });

  if (framing) {
    const photoChanged = couple?.photoUrl !== framing.uri;
    return (
      <Sheet visible title="Cadrer la photo" onClose={() => run(() => {
        if (isCurrent() && latest.current?.framing === framing) changeFraming(null);
      })}>
        <PhotoFrameEditor uri={framing.uri} frame={frame} disabled={busy || !couple || photoChanged} onChange={(next) => run(() => {
          if (canWrite() && latest.current?.framing === framing && latest.current.couple?.photoUrl === framing.uri) {
            latest.current.frame = next;
            setFrame(next);
          }
        })} />
        {photoChanged && <T>La photo a changé ou sa synchronisation est en cours. Reviens au formulaire puis rouvre le cadrage de la photo actuelle.</T>}
        <Button
          label="Enregistrer le cadrage"
          disabled={busy || !couple || photoChanged}
          onPress={() => runCurrent(async () => {
            if (latest.current?.framing !== framing || latest.current?.couple?.photoUrl !== framing.uri) return;
            await backend.updateCouple({ photoFrame: latest.current.frame });
            if (isCurrent()) changeFraming(null);
          })}
        />
      </Sheet>
    );
  }

  return (
    <Sheet visible title="Votre histoire" onClose={() => run(() => {
      if (latest.current?.framing === null) close();
    })}>
      <DateField label="Date de votre rencontre" value={value} disabled={busy || !couple} onChange={(next) => run(() => {
        if (canWrite() && latest.current?.framing === null) {
          latest.current.value = next;
          setValues(previous => ({ ...previous, since: next }));
        }
      })} maximumDate={new Date()} />
      <Button
        label="Enregistrer la date"
        disabled={value > todayKey() || busy || !couple}
        onPress={() => runCurrent(async () => {
          const current = latest.current;
          if (!current || current.framing !== null || current.value > todayKey()) return;
          if (current.value === current.couple?.since) { close(); return; }
          await backend.updateCouple({ since: current.value });
          close();
        })}
      />
      <Button
        label={couple?.photoUrl ? 'Changer la photo de couple' : 'Ajouter une photo de couple'}
        icon="image-outline"
        variant="outline"
        disabled={busy || !couple}
        onPress={changePhoto}
      />
      {!!couple?.photoUrl && (
        <Button label="Repositionner la photo" icon="move-outline" variant="outline" disabled={busy} onPress={() => run(() => {
          const current = latest.current?.couple;
          if (!canWrite() || latest.current?.framing !== null || !current?.photoUrl) return;
          changeFraming({ uri: current.photoUrl }, current.photoFrame ?? DEFAULT_FRAME);
        })} />
      )}
      {!couple && <T>Votre espace est indisponible. Attends sa synchronisation avant d’enregistrer.</T>}
    </Sheet>
  );
}
