import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { showDialog } from '@/components/dialog';
import { useAsyncAction } from '../use-async-action';
import { CoupleProvider, useCouple } from '../couple-context';
import { clearSession, loadSession, type Backend } from '../backend';
import type { Couple } from '../types';

jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ BothColor: '#000000' }));
jest.mock('../backend', () => ({ loadSession: jest.fn(), clearSession: jest.fn() }));

let root: ReactTestRenderer;
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });

test('un double appui ne crée pas deux enregistrements pendant une requête', async () => {
  let finish!: () => void;
  const write = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  let action!: ReturnType<typeof useAsyncAction>;
  function Form() { action = useAsyncAction(write); return null; }
  await act(async () => { root = create(<Form />); });
  let pending!: Promise<void>;
  await act(async () => { pending = action.run(); void action.run(); });
  expect(write).toHaveBeenCalledTimes(1);
  expect(action.pending).toBe(true);
  await act(async () => { finish(); await pending; });
  expect(action.pending).toBe(false);
});

test('un refus serveur est visible et autorise une nouvelle tentative', async () => {
  const write = jest.fn().mockRejectedValueOnce({ code: 'permission-denied' }).mockResolvedValue(undefined);
  let action!: ReturnType<typeof useAsyncAction>;
  function Form() { action = useAsyncAction(write); return null; }
  await act(async () => { root = create(<Form />); });
  await act(async () => { await action.run(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', expect.stringContaining('n’est pas autorisée'));
  expect(action.pending).toBe(false);
  await act(async () => { await action.run(); });
  expect(write).toHaveBeenCalledTimes(2);
});

test('une panne de restauration ne renvoie pas silencieusement vers la création de compte', async () => {
  const backend = { coupleId: 'existing', subscribeCouple: jest.fn(() => () => {}) } as unknown as Backend;
  (loadSession as jest.Mock).mockRejectedValueOnce({ code: 'unavailable' }).mockResolvedValueOnce(backend);
  let session!: ReturnType<typeof useCouple>;
  function Consumer() { session = useCouple(); return null; }
  await act(async () => { root = create(<CoupleProvider><Consumer /></CoupleProvider>); });
  expect(session.restoreError).toBe(true);
  expect(session.backend).toBeNull();
  expect(clearSession).not.toHaveBeenCalled();
  await act(async () => { await session.retrySession(); });
  expect(session.restoreError).toBe(false);
  expect(session.backend).toBe(backend);
  expect(clearSession).not.toHaveBeenCalled();
});

test('une panne de synchronisation se relance sans perdre le compte ni accepter un ancien callback', async () => {
  const listeners: { data: (couple: Couple | null) => void; error?: (error: unknown) => void; stop: jest.Mock }[] = [];
  const backend = {
    coupleId: 'existing',
    subscribeCouple: jest.fn((data, error) => {
      const stop = jest.fn();
      listeners.push({ data, error, stop });
      return stop;
    }),
  } as unknown as Backend;
  (loadSession as jest.Mock).mockResolvedValueOnce(backend);
  let session!: ReturnType<typeof useCouple>;
  function Consumer() { session = useCouple(); return null; }
  await act(async () => { root = create(<CoupleProvider><Consumer /></CoupleProvider>); });
  const couple: Couple = { id: 'existing', members: [] };
  await act(async () => { listeners[0].data(couple); });
  expect(session.couple).toBe(couple);
  await act(async () => { listeners[0].error?.({ code: 'permission-denied' }); });
  expect(session.syncError).toBe(true);
  expect(session.couple).toBeNull();
  expect(session.backend).toBe(backend);
  await act(async () => { session.retrySync(); });
  expect(listeners[0].stop).toHaveBeenCalledTimes(1);
  expect(listeners).toHaveLength(2);
  expect(session.syncError).toBe(true);
  await act(async () => { listeners[1].data(couple); });
  expect(session.syncError).toBe(false);
  await act(async () => { listeners[0].error?.({ code: 'unavailable' }); listeners[0].data(null); });
  expect(session.syncError).toBe(false);
  expect(session.couple).toBe(couple);
  expect(clearSession).not.toHaveBeenCalled();
  expect(loadSession).toHaveBeenCalledTimes(1);
});

test('un couple absent après connexion devient une erreur visible, pas un espace vide', async () => {
  const backend = { subscribeCouple: jest.fn((data) => { data(null); return jest.fn(); }) } as unknown as Backend;
  (loadSession as jest.Mock).mockResolvedValueOnce(backend);
  let session!: ReturnType<typeof useCouple>;
  function Consumer() { session = useCouple(); return null; }
  await act(async () => { root = create(<CoupleProvider><Consumer /></CoupleProvider>); });
  expect(session.syncError).toBe(true);
  expect(session.backend).toBe(backend);
  expect(clearSession).not.toHaveBeenCalled();
});
