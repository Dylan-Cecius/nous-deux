import { StrictMode, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CoupleProvider, useCouple } from '../couple-context';
import { clearSession, loadSession, type Backend } from '../backend';

jest.mock('../backend', () => ({ loadSession: jest.fn(), clearSession: jest.fn() }));
jest.mock('@/constants/theme', () => ({ BothColor: '#000000' }));

let root: ReactTestRenderer;
let session!: ReturnType<typeof useCouple>;
const oldBackend = { coupleId: 'old', subscribeCouple: jest.fn(() => jest.fn()) } as unknown as Backend;
const newBackend = { coupleId: 'new', subscribeCouple: jest.fn(() => jest.fn()) } as unknown as Backend;
let resolve!: (backend: Backend | null) => void;
let reject!: (error: Error) => void;
function Consumer() {
  const current = useCouple();
  useEffect(() => { session = current; });
  return null;
}
beforeEach(async () => {
  for (const b of [oldBackend, newBackend]) (b.subscribeCouple as jest.Mock).mockImplementation(() => jest.fn());
  (loadSession as jest.Mock).mockReturnValue(new Promise<Backend | null>((yes, no) => { resolve = yes; reject = no; }));
  (clearSession as jest.Mock).mockResolvedValue(undefined);
  await act(async () => { root = create(<CoupleProvider><Consumer /></CoupleProvider>); });
});
afterEach(async () => { await act(async () => root.unmount()); jest.resetAllMocks(); });

test('les reprises simultanées partagent la restauration déjà engagée', async () => {
  let first!: Promise<void>; let second!: Promise<void>;
  await act(async () => { first = session.retrySession(); second = session.retrySession(); });
  expect(loadSession).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(oldBackend); await Promise.all([first, second]); });
  expect(session.backend).toBe(oldBackend);
  expect(session.loading).toBe(false);
});

test.each(['success', 'failure'])('une restauration %s ne remplace pas une session explicitement choisie', async (result) => {
  await act(async () => { session.setBackend(newBackend); });
  await act(async () => { if (result === 'success') resolve(oldBackend); else reject(new Error('Ancienne lecture')); });
  expect(session.backend).toBe(newBackend);
  expect(session.restoreError).toBe(false);
  expect(session.loading).toBe(false);
});

test('une restauration retardée ne reconnecte pas après déconnexion', async () => {
  await act(async () => { await session.signOut(); });
  await act(async () => { resolve(oldBackend); });
  expect(session.backend).toBeNull();
  expect(session.loading).toBe(false);
  expect(oldBackend.subscribeCouple).not.toHaveBeenCalled();
});

test('les anciens gestionnaires ne lisent ni effacent la session après démontage', async () => {
  const old = session;
  await act(async () => { root.unmount(); });
  let retry!: Promise<void>;
  await act(async () => { retry = old.retrySession(); await old.signOut(); });
  await act(async () => { resolve(null); await retry; });
  expect(loadSession).toHaveBeenCalledTimes(1);
  expect(clearSession).not.toHaveBeenCalled();
});

test('un refus de déconnexion reste visible et conserve le backend courant', async () => {
  await act(async () => { resolve(oldBackend); });
  (clearSession as jest.Mock).mockRejectedValueOnce(new Error('Stockage indisponible'));
  await act(async () => { await expect(session.signOut()).rejects.toThrow('Stockage indisponible'); });
  expect(session.backend).toBe(oldBackend);
});

test('un refus de déconnexion pendant la restauration ne laisse pas un chargement bloqué', async () => {
  (clearSession as jest.Mock).mockRejectedValueOnce(new Error('Stockage indisponible'));
  await act(async () => { await expect(session.signOut()).rejects.toThrow('Stockage indisponible'); });
  await act(async () => { resolve(oldBackend); });
  expect(session.backend).toBe(oldBackend);
  expect(session.loading).toBe(false);
});

test('un résultat reçu après démontage ne crée aucun abonnement', async () => {
  await act(async () => { root.unmount(); resolve(oldBackend); });
  expect(oldBackend.subscribeCouple).not.toHaveBeenCalled();
});

test('le rejeu des effets en StrictMode ignore la première restauration abandonnée', async () => {
  await act(async () => { root.unmount(); });
  const callbacks: ((value: Backend) => void)[] = [];
  (loadSession as jest.Mock).mockReset().mockImplementation(() => new Promise<Backend>((yes) => callbacks.push(yes)));
  await act(async () => { root = create(<StrictMode><CoupleProvider><Consumer /></CoupleProvider></StrictMode>); });
  expect(callbacks).toHaveLength(2);
  await act(async () => { callbacks[1](newBackend); });
  await act(async () => { callbacks[0](oldBackend); });
  expect(session.backend).toBe(newBackend);
  expect(session.loading).toBe(false);
  expect(oldBackend.subscribeCouple).not.toHaveBeenCalled();
});
