import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { firebase } from '../firebase';
import { loadSession, signInWithEmail } from '../backend';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../firebase', () => ({ isFirebaseConfigured: true, firebase: jest.fn() }));
jest.mock('../photos', () => ({}));
jest.mock('../notifications', () => ({ clearReminders: jest.fn().mockResolvedValue(undefined) }));
jest.mock('firebase/auth', () => ({ signOut: jest.fn().mockResolvedValue(undefined), signInWithEmailAndPassword: jest.fn() }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn() }));
jest.mock('firebase/functions', () => ({}));
jest.mock('firebase/storage', () => ({}));

const oldRaw = JSON.stringify({ mode: 'cloud', coupleId: 'old', userId: 'alice' });
const newRaw = JSON.stringify({ mode: 'cloud', coupleId: 'new', userId: 'bob' });
const auth: { currentUser: { uid: string } | null; authStateReady: jest.Mock } = { currentUser: { uid: 'alice' }, authStateReady: jest.fn() };
const snapshot = { data: () => ({ coupleId: 'restored', members: ['alice'] }) };
beforeEach(async () => {
  jest.clearAllMocks();
  auth.currentUser = { uid: 'alice' };
  (firebase as jest.Mock).mockReturnValue({ auth, db: {} });
  (signInWithEmailAndPassword as jest.Mock).mockReset().mockResolvedValue({ user: { uid: 'alice' } });
  (getDoc as jest.Mock).mockReset().mockResolvedValue(snapshot);
  await AsyncStorage.setItem('session', oldRaw);
});

const paths = [
  ['restauration', () => loadSession()],
  ['reconnexion', () => signInWithEmail('alice@example.test', 'fictitious-password')],
] as const;
describe.each(paths)('%s après changement d’identité externe', (_name, enter) => {
  test.each([[0, 'success'], [0, 'permission-denied'], [1, 'success'], [1, 'permission-denied']] as const)('la lecture %i terminée en %s ne restaure ni ne nettoie la nouvelle session', async (readIndex, outcome) => {
    if (readIndex === 1) (getDoc as jest.Mock).mockResolvedValueOnce(snapshot);
    (getDoc as jest.Mock).mockImplementationOnce(async () => {
      auth.currentUser = { uid: 'bob' };
      await AsyncStorage.setItem('session', newRaw);
      if (outcome === 'permission-denied') throw { code: outcome };
      return snapshot;
    });
    await expect(enter()).rejects.toThrow('compte a changé');
    expect(signOut).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('session')).toBe(newRaw);
    expect(getDoc).toHaveBeenCalledTimes(readIndex + 1);
  });

  test('une déconnexion externe pendant la lecture empêche de rétablir l’ancien backend', async () => {
    (getDoc as jest.Mock).mockImplementationOnce(async () => {
      auth.currentUser = null;
      return snapshot;
    });
    await expect(enter()).rejects.toThrow('compte a changé');
    expect(signOut).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('session')).toBe(oldRaw);
  });
});

test('une restauration dont l’identité est déjà différente préserve le compte courant', async () => {
  auth.currentUser = { uid: 'bob' };
  await expect(loadSession()).rejects.toThrow('compte a changé');
  expect(signOut).not.toHaveBeenCalled();
  expect(getDoc).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('session')).toBe(oldRaw);
});

test('une session sans compte authentifié garde le nettoyage attendu', async () => {
  auth.currentUser = null;
  expect(await loadSession()).toBeNull();
  expect(await AsyncStorage.getItem('session')).toBeNull();
  expect(getDoc).not.toHaveBeenCalled();
});
