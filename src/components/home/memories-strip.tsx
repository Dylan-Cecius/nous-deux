import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { Button, Card, Ionicons, Row, SectionTitle, T } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { fromKey, todayKey } from '@/lib/dates';
import { success } from '@/lib/haptics';
import { pickPhoto } from '@/lib/photos';

/** Ajoute une photo aux souvenirs (utilisé ici et sur l'écran Souvenirs). */
export function useAddMemory() {
  const { backend } = useSession();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const add = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const picked = await pickPhoto();
      if (!picked) return;
      const photoUrl = await backend.uploadPhoto(picked.uri);
      await backend.add('memories', {
        photoUrl,
        caption: '',
        date: todayKey(),
        createdBy: backend.userId,
        createdAt: Date.now(),
      });
      success();
    } catch (e) {
      showDialog('Photo non enregistrée', e instanceof Error ? e.message : String(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return { add, busy };
}

/** Souvenirs sur l'accueil : « Il y a un an… » et les dernières photos. */
export function MemoriesStrip() {
  const t = useTheme();
  const memories = useCollectionState('memories');
  const { add, busy } = useAddMemory();
  const today = todayKey();
  const sorted = [...memories.items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const onThisDay = sorted.find((m) => m.date.slice(5) === today.slice(5) && m.date < today);
  const yearsAgo = onThisDay ? Number(today.slice(0, 4)) - Number(onThisDay.date.slice(0, 4)) : 0;

  if (memories.loading || memories.error) {
    return (
      <View style={{ gap: 12 }}>
        <SectionTitle title="Souvenirs" action="Tout voir" onAction={() => router.push('/souvenirs')} />
        <Card>
          <T>{memories.loading ? 'Chargement des souvenirs…' : 'Souvenirs indisponibles. Impossible de charger votre album pour le moment.'}</T>
          {memories.error && <Button label="Réessayer les souvenirs" variant="outline" onPress={memories.retry} />}
        </Card>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <SectionTitle title="Souvenirs" action="Tout voir" onAction={() => router.push('/souvenirs')} />
      {onThisDay && (
        <Card tone="feature" onPress={() => router.push('/souvenirs')} style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
          <Image source={{ uri: onThisDay.photoUrl }} style={{ width: '100%', height: 180 }} contentFit="cover" />
          <View style={{ padding: 16, gap: 2 }}>
            <T variant="caption" color={t.onFeatureMuted}>
              Il y a {yearsAgo} an{yearsAgo > 1 ? 's' : ''}
            </T>
            <T variant="h3" color={t.onFeature}>
              {onThisDay.caption || fromKey(onThisDay.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </T>
          </View>
        </Card>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un souvenir"
          onPress={add}
          disabled={busy}
          style={{
            width: 104,
            height: 132,
            borderRadius: 18,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: t.primary,
            backgroundColor: t.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
          {busy ? <ActivityIndicator color={t.primary} /> : <Ionicons name="add" size={28} color={t.primary} />}
          <T variant="small" color={t.primaryDark}>
            Photo
          </T>
        </Pressable>
        {sorted.slice(0, 8).map((m) => (
          <Pressable key={m.id} onPress={() => router.push('/souvenirs')} accessibilityLabel={m.caption || 'Souvenir'}>
            <Image source={{ uri: m.photoUrl }} style={{ width: 104, height: 132, borderRadius: 18 }} contentFit="cover" />
          </Pressable>
        ))}
      </ScrollView>
      {sorted.length === 0 && (
        <Row style={{ gap: 8 }}>
          <Ionicons name="images-outline" size={18} color={t.textSecondary} />
          <T variant="small" muted style={{ flex: 1 }}>
            Ajoutez vos photos : l’app vous les rappellera chaque année, le même jour.
          </T>
        </Row>
      )}
    </View>
  );
}
