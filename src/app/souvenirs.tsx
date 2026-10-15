import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAddMemory } from '@/components/home/memories-strip';
import { DateField } from '@/components/pickers';
import { Button, Card, confirmDelete, Empty, Fab, Field, Screen, Sheet, T } from '@/components/ui';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { fromKey } from '@/lib/dates';
import type { Memory } from '@/lib/types';

export default function Souvenirs() {
  const memories = useCollectionState('memories');
  const { add, busy } = useAddMemory();
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
      {editing && <MemorySheet memory={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function MemorySheet({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  const { backend } = useSession();
  const [caption, setCaption] = useState(memory.caption ?? '');
  const [date, setDate] = useState(memory.date);

  return (
    <Sheet visible title="Souvenir" onClose={onClose}>
      <Image source={{ uri: memory.photoUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 20 }} contentFit="cover" />
      <Field label="Légende" value={caption} maxLength={4000} onChangeText={setCaption} placeholder="Notre premier week-end à la mer" />
      <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />
      <Button
        label="Enregistrer"
        onPress={async () => {
          await backend.update('memories', memory.id, { caption: caption.trim(), date });
          onClose();
        }}
      />
      <Button
        label="Supprimer"
        variant="danger"
        icon="trash-outline"
        onPress={() =>
          confirmDelete(caption || 'ce souvenir', async () => {
            await backend.remove('memories', memory.id);
            onClose();
          })
        }
      />
    </Sheet>
  );
}
