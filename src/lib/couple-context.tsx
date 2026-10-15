import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { clearSession, loadSession, type Backend } from './backend';
import { BOTH, type CollectionName, type Collections, type Couple, type Member } from './types';
import { BothColor } from '@/constants/theme';

type CoupleState = {
  loading: boolean;
  restoreError: boolean;
  retrySession: () => Promise<void>;
  syncError: boolean;
  retrySync: () => void;
  backend: Backend | null;
  couple: Couple | null;
  setBackend: (backend: Backend) => void;
  signOut: () => Promise<void>;
  /** Oublie uniquement l’interface dont la suppression a déjà nettoyé la session. */
  completeDeletion: (deleted: Backend) => boolean;
};

const CoupleContext = createContext<CoupleState | null>(null);

type SessionWork = { active: boolean; revision: number; restoring: Promise<void> | null; backend: Backend | null };

export function CoupleProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [snapshot, setSnapshot] = useState<{ backend: Backend; couple: Couple | null } | null>(null);
  const couple = snapshot?.backend === backend ? snapshot?.couple ?? null : null;
  // Un résultat absent ou refusé n’est pas un couple vide ni une déconnexion.
  const syncError = !!backend && snapshot?.backend === backend && snapshot.couple === null;
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const retrySync = () => setSubscriptionAttempt((attempt) => attempt + 1);
  const [restoreError, setRestoreError] = useState(false);
  const work = useRef<SessionWork | null>(null);
  const restore = useCallback(async () => {
    const scope = work.current;
    if (!scope?.active) return;
    if (scope.restoring) return scope.restoring;
    const revision = ++scope.revision;
    const current = () => scope.active && scope.revision === revision;
    setLoading(true);
    scope.restoring = loadSession()
      .then((restored) => { if (current()) { scope.backend = restored; setBackend(restored); setRestoreError(false); } })
      .catch(() => { if (current()) setRestoreError(true); })
      .finally(() => { scope.restoring = null; if (current()) setLoading(false); });
    return scope.restoring;
  }, []);
  const chooseBackend = (next: Backend) => {
    const scope = work.current;
    if (!scope?.active) return;
    scope.revision++;
    scope.backend = next;
    setBackend(next);
    setRestoreError(false);
    setLoading(false);
  };

  useEffect(() => {
    const scope: SessionWork = { active: true, revision: 0, restoring: null, backend: null };
    work.current = scope;
    void restore();
    return () => { scope.active = false; };
  }, [restore]);

  useEffect(() => {
    if (!backend) return;
    let active = true;
    const receive = (couple: Couple | null) => { if (active) setSnapshot({ backend, couple }); };
    const stop = backend.subscribeCouple(receive, () => receive(null));
    return () => { active = false; stop(); };
  }, [backend, subscriptionAttempt]);

  const signOut = async () => {
    const scope = work.current;
    if (!scope?.active) return;
    const revision = scope.revision;
    await clearSession();
    if (!scope.active || scope.revision !== revision) return;
    scope.revision++;
    scope.backend = null;
    setBackend(null);
    setSnapshot(null);
    setRestoreError(false);
    setLoading(false);
  };

  const completeDeletion = (deleted: Backend) => {
    const scope = work.current;
    if (!scope?.active || scope.backend !== deleted) return false;
    scope.revision++;
    scope.backend = null;
    setBackend(null);
    setSnapshot(null);
    setRestoreError(false);
    setLoading(false);
    return true;
  };

  return (
    <CoupleContext.Provider value={{ loading, restoreError, retrySession: restore, syncError, retrySync, backend, couple, setBackend: chooseBackend, signOut, completeDeletion }}>
      {children}
    </CoupleContext.Provider>
  );
}

export function useCouple() {
  const ctx = useContext(CoupleContext);
  if (!ctx) throw new Error('useCouple doit être utilisé dans <CoupleProvider>');
  return ctx;
}

/** À utiliser dans les écrans une fois connecté : backend et couple sont garantis. */
export function useSession() {
  const { backend, couple, signOut } = useCouple();
  if (!backend) throw new Error('Pas de session');
  const members = couple?.members ?? [];
  const me = members.find((m) => m.id === backend.userId);
  const partner = members.find((m) => m.id !== backend.userId);

  const member = (id: string): Member | undefined => members.find((m) => m.id === id);
  const nameOf = (id: string) => (id === BOTH ? 'Nous deux' : (member(id)?.name ?? '…'));
  const colorOf = (id: string) => (id === BOTH ? BothColor : (member(id)?.color ?? '#999999'));

  return { backend, couple, members, me, partner, nameOf, colorOf, signOut };
}

/** Abonnement temps réel avec résultat associé à la session et à la tentative courantes. */
export function useCollectionState<K extends CollectionName>(name: K) {
  const { backend } = useCouple();
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((value) => value + 1);
  const [snapshot, setSnapshot] = useState<{
    backend: Backend; name: K; attempt: number; items: Collections[K][]; error: boolean;
  } | null>(null);

  useEffect(() => {
    if (!backend) return;
    let active = true;
    const stop = backend.subscribe(name,
      (items) => { if (active) setSnapshot({ backend, name, attempt, items, error: false }); },
      () => {
        if (!active) return;
        active = false;
        setSnapshot({ backend, name, attempt, items: [], error: true });
      },
    );
    return () => { active = false; stop(); };
  }, [backend, name, attempt]);

  const current = snapshot?.backend === backend && snapshot?.name === name && snapshot?.attempt === attempt ? snapshot : null;
  return { items: current?.items ?? [], loading: current === null, error: current?.error ?? false, retry };
}

/** Compatibilité des écrans dont l’affichage des erreurs reste à migrer. */
export function useCollection<K extends CollectionName>(name: K) {
  return useCollectionState(name).items;
}
