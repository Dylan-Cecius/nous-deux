import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { billingEnabled, FREE_SUBSCRIPTION, nativeBillingAvailable, type SubscriptionStatus } from './billing';
import { useCouple } from './couple-context';

/** Access is always checked against the current couple by a trusted server. */
export function useSubscription() {
  const { backend } = useCouple();
  const [snapshot, setSnapshot] = useState<{ backend: typeof backend; status: SubscriptionStatus } | null>(null);
  const [loading, setLoading] = useState(billingEnabled && backend?.mode === 'cloud');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++request.current;
    if (!billingEnabled || backend?.mode !== 'cloud') {
      setSnapshot(null); setLoading(false); setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const status = await backend.call<SubscriptionStatus>('getSubscription', {});
      if (request.current === id) { setNow(Date.now()); setSnapshot({ backend, status }); }
    } catch {
      if (request.current === id) {
        setSnapshot(null);
        setError('Impossible de vérifier votre abonnement. Réessaie avec une connexion internet.');
      }
    } finally {
      if (request.current === id) setLoading(false);
    }
  }, [backend]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return refresh(); });
    return () => { active = false; ++request.current; };
  }, [refresh]));

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { listener.remove(); };
  }, [refresh]);

  const status = snapshot?.backend === backend ? snapshot.status : FREE_SUBSCRIPTION;
  const active = status.active && (status.expiresAt === null || status.expiresAt > now);
  const expiry = active ? status.expiresAt : null;
  useEffect(() => {
    if (expiry === null) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
      void refresh();
    }, Math.min(Math.max(0, expiry - Date.now()) + 20, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiry, now, refresh]);
  return { ...status, active, loading, error, refresh, available: nativeBillingAvailable && backend?.mode === 'cloud' };
}
