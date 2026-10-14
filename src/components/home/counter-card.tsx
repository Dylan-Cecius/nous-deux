import { useState } from 'react';


import { showDialog } from '@/components/dialog';
import { DEFAULT_FRAME, PhotoFrameEditor } from '@/components/framed-photo';
import { DateField } from '@/components/pickers';
import { Button, Sheet } from '@/components/ui';

import { useSession } from '@/lib/couple-context';
import { todayKey } from '@/lib/dates';
import { pickPhoto } from '@/lib/photos';

/** Réglages de la carte « Ensemble depuis » : date de rencontre et photo de couple. */
export function CounterSheet({ onClose }: { onClose: () => void }) {
  const { backend, couple } = useSession();
  const [value, setValue] = useState(couple?.since ?? todayKey());
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState(couple?.photoFrame ?? DEFAULT_FRAME);
  const [framing, setFraming] = useState(false);

  const changePhoto = async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    setBusy(true);
    try {
      await backend.updateCouple({ photoUrl: await backend.uploadPhoto(picked.uri), photoFrame: DEFAULT_FRAME });
      setFrame(DEFAULT_FRAME);
      setFraming(true);
    } catch (e) {
      showDialog('Photo non enregistrée', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (framing && couple?.photoUrl) {
    return (
      <Sheet visible title="Cadrer la photo" onClose={() => setFraming(false)}>
        <PhotoFrameEditor uri={couple.photoUrl} frame={frame} onChange={setFrame} />
        <Button
          label="Enregistrer le cadrage"
          onPress={() => {
            backend.updateCouple({ photoFrame: frame });
            setFraming(false);
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet visible title="Votre histoire" onClose={onClose}>
      <DateField label="Date de votre rencontre" value={value} onChange={setValue} maximumDate={new Date()} />
      <Button
        label="Enregistrer la date"
        disabled={value > todayKey()}
        onPress={() => {
          backend.updateCouple({ since: value });
          onClose();
        }}
      />
      <Button
        label={couple?.photoUrl ? 'Changer la photo de couple' : 'Ajouter une photo de couple'}
        icon="image-outline"
        variant="outline"
        disabled={busy}
        onPress={changePhoto}
      />
      {!!couple?.photoUrl && (
        <Button label="Repositionner la photo" icon="move-outline" variant="outline" onPress={() => setFraming(true)} />
      )}
    </Sheet>
  );
}
