import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import { celebrate } from './celebrate';
import { useCollection, useCollectionState, useSession } from '@/lib/couple-context';
import { success } from '@/lib/haptics';
import { getPushToken, scheduleCountdownReminders } from '@/lib/notifications';

/** Tâches discrètes : notifications, rappels, et pluie de cœurs quand ta moitié pense à toi. */
export function BackgroundTasks() {
  const { backend, me, partner } = useSession();
  const { items: dates, loading: datesLoading, error: datesError } = useCollectionState('dates');
  const notes = useCollection('notes');
  const myId = me?.id;

  // Jeton push : seulement en mode cloud (en local, personne d'autre ne peut nous écrire).
  useEffect(() => {
    if (backend.mode !== 'cloud' || !myId) return;
    getPushToken().then(async (token) => {
      if (token) await backend.call('registerPushToken', { token });
    }).catch(() => { /* Nouvelle tentative à la prochaine ouverture. */ });
  }, [backend, myId]);

  // Rappels « J-1 » et « Jour J » pour les comptes à rebours.
  useEffect(() => {
    // Une liste inconnue n'est pas une liste vide : ne pas effacer les rappels existants.
    if (datesLoading || datesError) return;
    scheduleCountdownReminders(dates).catch(() => {});
  }, [dates, datesLoading, datesError]);

  // Dernier cœur déjà « vu » sur ce téléphone (date d'envoi), mémorisé entre deux ouvertures.
  const seenKey = `seen:ping:${backend.coupleId}`;
  const seen = useRef<number | null>(null);
  const [seenLoaded, setSeenLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(seenKey).then((v) => {
      seen.current = v ? Number(v) : null;
      setSeenLoaded(true);
    });
  }, [seenKey]);

  // Un nouveau cœur de ta moitié (reçu pendant que l'app était fermée, ou à l'instant) : pluie de cœurs.
  const latestPing = notes
    .filter((n) => n.kind === 'ping' && n.from !== backend.userId)
    .reduce((max, n) => Math.max(max, n.createdAt), 0);
  const partnerName = partner?.name;

  useEffect(() => {
    if (!seenLoaded || !latestPing) return;
    const firstLaunch = seen.current === null;
    if (!firstLaunch && latestPing <= seen.current!) return;
    seen.current = latestPing;
    AsyncStorage.setItem(seenKey, String(latestPing));
    // À la toute première ouverture, on ne rejoue pas les anciens cœurs.
    if (firstLaunch) return;
    success();
    celebrate('hearts', `${partnerName ?? 'Ta moitié'} pense à toi 💗`);
  }, [seenLoaded, latestPing, seenKey, partnerName]);

  return null;
}
