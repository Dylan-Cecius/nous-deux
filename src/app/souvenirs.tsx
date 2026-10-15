import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAddMemory } from '@/components/home/memories-strip';
import { DateField } from '@/components/pickers';
import { Button, Card, confirmDelete, Empty, Fab, Field, Screen, Sheet, T } from '@/components/ui';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { fromKey, todayKey } from '@/lib/dates';
import type { Memory } from '@/lib/types';
import { useAsyncAction } from '@/lib/use-async-action';

export default function Souvenirs() {
  const { backend } = useSession();
  return <SouvenirsContent key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

function SouvenirsContent() {
  const memories = useCollectionState('memories');
  const { add, busy } = useAddMemory(!memories.loading && !memories.error);
  const [editing, setEditing] = useState<Memory | null>(null);

  const unavailable = memories.loading || memories.error;
  const sorted = [...memories.items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const years = [...new Set(sorted.map((m) => m.date.slice(0, 4)))];

  return (
    <>
      <Screen overline={unavailable ? 'Votre album' : `${memories.items.length} photo${memories.items.length > 1 ? 's' : ''}`} title="Souvenirs" onBack={() => router.back()}>
        {unavailable ? (
          <Card>
            <T>{memories.loading ? 'Chargement des souvenirs…' : 'Souvenirs indisponibles. Impossible de charger votre album pour le moment.'}</T>
            {memories.error && <Button label="Réessayer les souvenirs" variant="outline" onPress={memories.retry} />}
          </Card>
        ) : sorted.length === 0 ? (
          <Empty
            icon="images-outline"
            title="Votre album à deux"
            text="Ajoutez vos plus belles photos. Chaque année, l’app vous rappellera ce que vous faisiez ce jour-là."
          />
        ) : (
          years.map((year) => (
            <View key={year} style={{ gap: 10 }}>
              <T variant="h2">{year}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {sorted
                  .filter((m) => m.date.startsWith(year))
                  .map((m) => (
                    <Pressable key={m.id} onPress={() => setEditing(m)} style={{ width: '48%', flexGrow: 1, gap: 6 }}>
                      <Image source={{ uri: m.photoUrl }} style={{ width: '100%', aspectRatio: 0.8, borderRadius: 18 }} contentFit="cover" />
                      <T variant="small" numberOfLines={1}>
                        {m.caption || fromKey(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      </T>
                    </Pressable>
                  ))}
              </View>
            </View>
          ))
        )}
      </Screen>
      {!unavailable && <Fab onPress={add} label={busy ? 'Envoi en cours' : 'Ajouter une photo'} />}
      {editing && <MemorySheet key={editing.id} memory={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function MemorySheet({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  const { backend } = useSession();
  const collection = useCollectionState('memories');
  const context = useMemo(() => ({ backend }), [backend]);
  const latest = useRef<{ context: typeof context; collection: typeof collection } | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    latest.current = { context, collection };
    return () => { latest.current = null; };
  }, [context, collection]);
  const [caption, setCaption] = useState(memory.caption ?? '');
  const [date, setDate] = useState(memory.date);
  const { run, pending } = useAsyncAction((action: () => unknown) => action());
  const isCurrent = () => !closed.current && latest.current?.context === context;
  const containsMemory = (state: typeof collection) => state.items.some((entry) => entry.id === memory.id);
  const unavailable = collection.loading || collection.error || !containsMemory(collection);
  const canWrite = () => {
    const state = latest.current?.collection;
    return isCurrent() && state && !state.loading && !state.error && containsMemory(state);
  };
  const close = () => { if (isCurrent()) { closed.current = true; onClose(); } };
  const runCurrent = (action: () => Promise<void>) => run(async () => {
    if (!canWrite()) return;
    try { await action(); }
    catch (error) { if (isCurrent()) throw error; }
  });
  const save = () => runCurrent(async () => {
    if (date > todayKey()) return;
    await backend.update('memories', memory.id, { caption: caption.trim(), date });
    close();
  });
  const remove = () => {
    if (pending || !canWrite()) return;
    confirmDelete(caption || 'ce souvenir', () => runCurrent(async () => {
      await backend.remove('memories', memory.id);
      close();
    }));
  };

  return (
    <Sheet visible title="Souvenir" onClose={() => run(close)}>
      {!unavailable && <Image source={{ uri: memory.photoUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 20 }} contentFit="cover" />}
      <Field label="Légende" value={caption} maxLength={4000} editable={!pending} onChangeText={(value) => run(() => { if (isCurrent()) setCaption(value); })} placeholder="Notre premier week-end à la mer" />
      <DateField label="Date" value={date} disabled={pending} onChange={(value) => run(() => { if (isCurrent()) setDate(value); })} maximumDate={new Date()} />
      {date > todayKey() && <T variant="small">La date du souvenir ne peut pas être dans le futur.</T>}
      {unavailable && <T variant="small" muted>Album indisponible ou souvenir retiré. Ton brouillon est conservé ; recharge l’album avant de continuer.</T>}
      {collection.error && <Button label="Recharger l’album du formulaire" variant="outline" onPress={collection.retry} />}
      <Button label="Enregistrer" disabled={pending || unavailable || date > todayKey()} onPress={save} />
      <Button
        label="Supprimer"
        variant="danger"
        icon="trash-outline"
        disabled={pending || unavailable}
        onPress={remove}
      />
    </Sheet>
  );
}
