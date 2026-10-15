import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_FRAME, PhotoFrameEditor } from '@/components/framed-photo';
import { DateField } from '@/components/pickers';
import { Button, Sheet, T } from '@/components/ui';

import { useSession } from '@/lib/couple-context';
import { todayKey } from '@/lib/dates';
import { pickPhoto } from '@/lib/photos';
import { useAsyncAction } from '@/lib/use-async-action';

/** Réglages de la carte « Ensemble depuis » : date de rencontre et photo de couple. */
export function CounterSheet({ onClose }: { onClose: () => void }) {
  const { backend } = useSession();
  return <CounterForm key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} onClose={onClose} />;
}

function CounterForm({ onClose }: { onClose: () => void }) {
  const { backend, couple } = useSession();
  const [value, setValue] = useState(couple?.since ?? todayKey());
  const [frame, setFrame] = useState(couple?.photoFrame ?? DEFAULT_FRAME);
  const [framing, setFraming] = useState<{ uri: string } | null>(null);
  const context = useMemo(() => ({ backend }), [backend]);
  const latest = useRef<{ context: typeof context; couple: typeof couple; framing: typeof framing } | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    latest.current = { context, couple, framing };
    return () => { latest.current = null; };
  }, [context, couple, framing]);
  const { run, pending: busy } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => !closed.current && latest.current?.context === context;
  const canWrite = () => isCurrent() && !!latest.current?.couple;
  const close = () => { if (isCurrent()) { closed.current = true; onClose(); } };
  const runCurrent = (action: () => Promise<void>) => run(async () => {
    if (!canWrite()) return;
    try { await action(); }
    catch (error) { if (isCurrent()) throw error; }
  });

  const changePhoto = () => runCurrent(async () => {
    const picked = await pickPhoto();
    if (!picked || !canWrite()) return;
    const photoUrl = await backend.uploadPhoto(picked.uri);
    if (!canWrite()) return;
    await backend.updateCouple({ photoUrl, photoFrame: DEFAULT_FRAME });
    if (!isCurrent()) return;
    setFrame(DEFAULT_FRAME);
    setFraming({ uri: photoUrl });
  });

  if (framing) {
    const photoChanged = couple?.photoUrl !== framing.uri;
    return (
      <Sheet visible title="Cadrer la photo" onClose={() => run(() => { if (isCurrent()) setFraming(null); })}>
        <PhotoFrameEditor uri={framing.uri} frame={frame} disabled={busy || !couple || photoChanged} onChange={(next) => run(() => {
          if (canWrite() && latest.current?.framing === framing && latest.current?.couple?.photoUrl === framing.uri) setFrame(next);
        })} />
        {photoChanged && <T>La photo a changé ou sa synchronisation est en cours. Reviens au formulaire puis rouvre le cadrage de la photo actuelle.</T>}
        <Button
          label="Enregistrer le cadrage"
          disabled={busy || !couple || photoChanged}
          onPress={() => runCurrent(async () => {
            if (latest.current?.framing !== framing || latest.current?.couple?.photoUrl !== framing.uri) return;
            await backend.updateCouple({ photoFrame: frame });
            if (isCurrent()) setFraming(null);
          })}
        />
      </Sheet>
    );
  }

  return (
    <Sheet visible title="Votre histoire" onClose={() => run(close)}>
      <DateField label="Date de votre rencontre" value={value} onChange={setValue} maximumDate={new Date()} />
      <Button
        label="Enregistrer la date"
        disabled={value > todayKey() || busy || !couple}
        onPress={() => runCurrent(async () => {
          if (value > todayKey()) return;
          await backend.updateCouple({ since: value });
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
          if (!canWrite() || !current?.photoUrl) return;
          setFrame(current.photoFrame ?? DEFAULT_FRAME);
          setFraming({ uri: current.photoUrl });
        })} />
      )}
      {!couple && <T>Votre espace est indisponible. Attends sa synchronisation avant d’enregistrer.</T>}
    </Sheet>
  );
}
