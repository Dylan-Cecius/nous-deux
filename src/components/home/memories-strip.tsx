import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { MemoryPhoto } from '@/components/memory-photo';
import { Button, Card, Ionicons, Row, SectionTitle, T } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { fromKey, todayKey } from '@/lib/dates';
import { success } from '@/lib/haptics';
import { pickPhoto } from '@/lib/photos';
import { useToday } from '@/lib/use-today';

/** Ajoute une photo aux souvenirs (utilisé ici et sur l'écran Souvenirs). */
export function useAddMemory(available: boolean) {
  const { backend } = useSession();
  const context = useMemo(() => ({ backend, available }), [backend, available]);
  const [pendingBackends, setPendingBackends] = useState<(typeof backend)[]>([]);
  const lockedBackends = useRef(new Set<typeof backend>());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const scopeRef = useRef<{ context: typeof context; active: boolean; sending: boolean } | null>(null);
  useEffect(() => {
    const scope = { context, active: context.available, sending: false };
    scopeRef.current = scope;
    return () => { scope.active = false; };
  }, [context]);
  const add = async () => {
    const scope = scopeRef.current;
    if (!scope?.active || scope.context !== context || scope.sending || lockedBackends.current.has(backend)) return;
    scope.sending = true;
    lockedBackends.current.add(backend);
    setPendingBackends((previous) => [...previous, backend]);
    let stage: 'selection' | 'upload' | 'save' = 'selection';
    try {
      const picked = await pickPhoto();
      if (!picked || !scope.active) return;
      stage = 'upload';
      const photoUrl = await backend.uploadPhoto(picked.uri);
      if (!scope.active) return;
      stage = 'save';
      await backend.add('memories', {
        photoUrl,
        caption: '',
        date: todayKey(),
        createdBy: backend.userId,
        createdAt: Date.now(),
      });
      if (scope.active) success();
    } catch {
      if (scope.active) {
        showDialog(stage === 'save' ? 'Enregistrement non confirmé' : 'Photo non enregistrée', stage === 'save'
          ? 'Vérifie ton album après son actualisation avant de réessayer : la photo peut déjà avoir été enregistrée.'
          : stage === 'selection'
            ? 'Impossible de préparer cette photo. Vérifie son accès ou choisis une autre image.'
            : 'Impossible de préparer la photo pour l’album. Vérifie l’accès à la photo et ta connexion avant de réessayer.');
      }
    } finally {
      scope.sending = false;
      lockedBackends.current.delete(backend);
      if (mounted.current) setPendingBackends((previous) => previous.filter((entry) => entry !== backend));
    }
  };
  return { add, busy: pendingBackends.includes(backend) };
}

/** Souvenirs sur l'accueil : « Il y a un an… » et les dernières photos. */
export function MemoriesStrip() {
  const t = useTheme();
  const memories = useCollectionState('memories');
  const { add, busy } = useAddMemory(!memories.loading && !memories.error);
  const today = useToday();
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
          <MemoryPhoto uri={onThisDay.photoUrl} style={{ width: '100%', height: 180 }} />
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
            <MemoryPhoto uri={m.photoUrl} style={{ width: 104, height: 132, borderRadius: 18 }} />
          </Pressable>
        ))}
      </ScrollView>
      {sorted.length === 0 && (
        <Row style={{ gap: 8 }}>
          <Ionicons name="images-outline" size={18} color={t.textSecondary} />
          <T variant="small" muted style={{ flex: 1 }}>
            Ajoutez vos photos : retrouvez sur l’accueil un souvenir des années passées à la même date.
          </T>
        </Row>
      )}
    </View>
  );
}
