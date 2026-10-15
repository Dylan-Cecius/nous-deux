import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { clearSession, loadSession, signInWithEmail, createLocalCouple } from '../backend';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../photos', () => ({ toCompactDataUri: jest.fn() }));
jest.mock('../notifications', () => ({ clearReminders: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../firebase', () => ({ isFirebaseConfigured: true, firebase: () => ({ auth: { authStateReady: jest.fn(), currentUser: { uid: 'alice' } }, db: {} }) }));
jest.mock('firebase/auth', () => ({ signOut: jest.fn(), signInWithEmailAndPassword: jest.fn() }));
jest.mock('firebase/firestore', () => ({ getDoc: jest.fn(), doc: jest.fn() }));
jest.mock('firebase/functions', () => ({}));
jest.mock('firebase/storage', () => ({}));

function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const snapshot = { data: () => ({ coupleId: 'new', members: ['alice'] }) };
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (signOut as jest.Mock).mockReset().mockResolvedValue(undefined);
  (signInWithEmailAndPassword as jest.Mock).mockReset().mockResolvedValue({ user: { uid: 'alice' } });
  (getDoc as jest.Mock).mockReset().mockResolvedValue(snapshot);
});
const login = () => signInWithEmail('alice@example.test', 'fictitious-password');
const stored = async () => JSON.parse((await AsyncStorage.getItem('session')) ?? 'null');

test('une restauration refusée finit son nettoyage avant une nouvelle connexion', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'old' }));
  const read = deferred<typeof snapshot>(); const started = deferred<void>();
  (getDoc as jest.Mock).mockImplementationOnce(() => { started.resolve(); return read.promise; });
  const restoring = loadSession(); await started.promise;
  const entering = login();
  // Laisser une connexion non coordonnée avancer, sans dépendre d’un nombre de microtâches.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const prematureLogin = (signInWithEmailAndPassword as jest.Mock).mock.calls.length;
  read.reject({ code: 'permission-denied' });
  await Promise.all([restoring, entering]);
  expect(prematureLogin).toBe(0);
  expect(await stored()).toEqual({ mode: 'cloud', userId: 'alice', coupleId: 'new' });
});

test.each(['cloud', 'local'])('une déconnexion retardée ne retire pas la nouvelle session %s', async (mode) => {
  const clearing = deferred<void>(); const started = deferred<void>();
  (signOut as jest.Mock).mockImplementationOnce(() => { started.resolve(); return clearing.promise; });
  const leaving = clearSession(); await started.promise;
  const entering = mode === 'cloud' ? login() : createLocalCouple({ name: 'Alice fictive', color: '#111111' }, { name: 'Bob fictif', color: '#222222' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  clearing.resolve(); await Promise.all([leaving, entering]);
  expect((await stored())?.mode).toBe(mode);
});

test('une déconnexion demandée après la connexion attend sa mémorisation', async () => {
  const signingIn = deferred<{ user: { uid: string } }>(); const started = deferred<void>();
  (signInWithEmailAndPassword as jest.Mock).mockImplementationOnce(() => { started.resolve(); return signingIn.promise; });
  const entering = login(); await started.promise;
  const leaving = clearSession();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const prematureLogout = (signOut as jest.Mock).mock.calls.length;
  signingIn.resolve({ user: { uid: 'alice' } }); await Promise.all([entering, leaving]);
  expect(prematureLogout).toBe(0);
  expect(await stored()).toBeNull();
});

test('une opération refusée ne bloque pas les demandes suivantes', async () => {
  (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce({ code: 'auth/network-request-failed' });
  const result = await Promise.allSettled([login(), login()]);
  expect(result.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
  expect((await stored())?.coupleId).toBe('new');
});
