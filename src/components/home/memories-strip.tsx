import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { Button, Card, Ionicons, Row, SectionTitle, T } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { fromKey, todayKey } from '@/lib/dates';
import { success } from '@/lib/haptics';
import { pickPhoto } from '@/lib/photos';

/** Ajoute une photo aux souvenirs (utilisé ici et sur l'écran Souvenirs). */
export function useAddMemory(available: boolean) {
  const { backend } = useSession();
  const context = useMemo(() => ({ backend, available }), [backend, available]);
  const [progress, setProgress] = useState<{ context: typeof context; busy: boolean } | null>(null);
  const scopeRef = useRef<{ context: typeof context; active: boolean; sending: boolean } | null>(null);
  useEffect(() => {
    const scope = { context, active: context.available, sending: false };
    scopeRef.current = scope;
    return () => { scope.active = false; };
  }, [context]);
  const add = async () => {
    const scope = scopeRef.current;
    if (!scope?.active || scope.context !== context || scope.sending) return;
    scope.sending = true;
    setProgress({ context, busy: true });
    let saving = false;
    try {
      const picked = await pickPhoto();
      if (!picked || !scope.active) return;
      const photoUrl = await backend.uploadPhoto(picked.uri);
      if (!scope.active) return;
      saving = true;
      await backend.add('memories', {
        photoUrl,
        caption: '',
        date: todayKey(),
        createdBy: backend.userId,
        createdAt: Date.now(),
      });
      if (scope.active) success();
    } catch (e) {
      if (scope.active) {
        const detail = e instanceof Error ? e.message : String(e);
        showDialog(saving ? 'Enregistrement non confirmé' : 'Photo non enregistrée', saving
          ? `Vérifie ton album après son actualisation avant de réessayer : la photo peut déjà avoir été enregistrée.\n\n${detail}`
          : detail);
      }
    } finally {
      scope.sending = false;
      if (scope.active) setProgress({ context, busy: false });
    }
  };
  return { add, busy: progress?.context === context && progress.busy };
}

/** Souvenirs sur l'accueil : « Il y a un an… » et les dernières photos. */
export function MemoriesStrip() {
  const t = useTheme();
  const memories = useCollectionState('memories');
  const { add, busy } = useAddMemory(!memories.loading && !memories.error);
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
        <Card
          tone="feature" onPress={() => router.push('/souvenirs')}
          accessibilityLabel={`Souvenir du ${fromKey(onThisDay.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}${onThisDay.caption ? ` : ${onThisDay.caption}` : ''}`}
          accessibilityHint="Ouvre l’album des souvenirs."
          style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
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
          accessibilityState={{ disabled: busy, busy }}
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
          <Pressable
            key={m.id} onPress={() => router.push('/souvenirs')}
            accessibilityRole="button"
            accessibilityLabel={`Souvenir du ${fromKey(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}${m.caption ? ` : ${m.caption}` : ''}`}
            accessibilityHint="Ouvre l’album des souvenirs.">
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
