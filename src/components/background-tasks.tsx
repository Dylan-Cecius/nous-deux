import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import { celebrate } from './celebrate';
import { useCollectionState, useSession } from '@/lib/couple-context';
import { success } from '@/lib/haptics';
import { getPushToken, scheduleCountdownReminders } from '@/lib/notifications';

/** Tâches discrètes : notifications, rappels, et pluie de cœurs quand ta moitié pense à toi. */
export function BackgroundTasks() {
  const { backend, me } = useSession();
  const { items: dates, loading: datesLoading, error: datesError } = useCollectionState('dates');
  const myId = me?.id;

  // Jeton push : seulement en mode cloud (en local, personne d'autre ne peut nous écrire).
  useEffect(() => {
    if (backend.mode !== 'cloud' || !myId) return;
    let active = true;
    getPushToken().then(async (token) => {
      if (active && token) await backend.call('registerPushToken', { token });
    }).catch(() => { /* Nouvelle tentative à la prochaine ouverture. */ });
    return () => { active = false; };
  }, [backend, myId]);

  // Rappels « J-1 » et « Jour J » pour les comptes à rebours.
  useEffect(() => {
    // Une liste inconnue n'est pas une liste vide : ne pas effacer les rappels existants.
    if (datesLoading || datesError) return;
    scheduleCountdownReminders(dates).catch(() => {});
  }, [dates, datesLoading, datesError]);

  return <ReceivedHearts key={`${backend.mode}:${backend.coupleId}:${backend.userId}`} />;
}

/** L'état de lecture local appartient à cet espace et à ce membre, jamais au précédent. */
function ReceivedHearts() {
  const { backend, partner } = useSession();
  const { items: notes, loading, error } = useCollectionState('notes');

  // Dernier cœur déjà « vu » sur ce téléphone (date d'envoi), mémorisé entre deux ouvertures.
  const seenKey = `seen:ping:${backend.coupleId}`;
  const seen = useRef<number | null>(null);
  const [seenLoaded, setSeenLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(seenKey).then((v) => {
      if (!active) return;
      const timestamp = v?.trim() ? Number(v) : NaN;
      seen.current = Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
      setSeenLoaded(true);
    }).catch(() => { /* Ne pas rejouer l'historique si son marqueur est inaccessible. */ });
    return () => { active = false; };
  }, [seenKey]);

  // Un nouveau cœur de ta moitié (reçu pendant que l'app était fermée, ou à l'instant) : pluie de cœurs.
  const latestPing = notes
    .filter((n) => n.kind === 'ping' && n.from !== backend.userId)
    .reduce((max, n) => Math.max(max, n.createdAt), 0);
  const partnerName = partner?.name;

  useEffect(() => {
    if (!seenLoaded || loading || error || !latestPing) return;
    const firstLaunch = seen.current === null;
    if (!firstLaunch && latestPing <= seen.current!) return;
    seen.current = latestPing;
    // Garder le marqueur en mémoire même si sa persistance échoue, sans rejet non géré.
    AsyncStorage.setItem(seenKey, String(latestPing)).catch(() => {});
    // À la toute première ouverture, on ne rejoue pas les anciens cœurs.
    if (firstLaunch) return;
    success();
    celebrate('hearts', `${partnerName ?? 'Ta moitié'} pense à toi 💗`);
  }, [seenLoaded, loading, error, latestPing, seenKey, partnerName]);

  return null;
}
