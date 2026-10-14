import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { clearSession, loadSession, type Backend } from './backend';
import { BOTH, type CollectionName, type Collections, type Couple, type Member } from './types';
import { BothColor } from '@/constants/theme';

type CoupleState = {
  loading: boolean;
  backend: Backend | null;
  couple: Couple | null;
  setBackend: (backend: Backend) => void;
  signOut: () => Promise<void>;
};

const CoupleContext = createContext<CoupleState | null>(null);

export function CoupleProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);

  useEffect(() => {
    loadSession()
      .then(setBackend)
      .catch((e) => console.warn('Impossible de restaurer la session', e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!backend) return;
    return backend.subscribeCouple(setCouple);
  }, [backend]);

  const signOut = async () => {
    await clearSession();
    setBackend(null);
    setCouple(null);
  };

  return (
    <CoupleContext.Provider value={{ loading, backend, couple, setBackend, signOut }}>
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

/** Abonnement temps réel à une collection du couple. */
export function useCollection<K extends CollectionName>(name: K) {
  const { backend } = useCouple();
  const [items, setItems] = useState<Collections[K][]>([]);

  useEffect(() => {
    if (!backend) return;
    return backend.subscribe(name, setItems);
  }, [backend, name]);

  return items;
}
