import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut, signInAnonymously } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { clearSession, loadSession, deleteMyAccount, type Backend } from '../backend';
import { firebase } from '../firebase';
import { clearReminders } from '../notifications';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../photos', () => ({ toCompactDataUri: jest.fn() }));
jest.mock('../notifications', () => ({ clearReminders: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../firebase', () => ({
  isFirebaseConfigured: true,
  firebase: jest.fn(() => ({ auth: { authStateReady: jest.fn(), currentUser: { uid: 'alice' } }, db: {}, functions: {} })),
}));
jest.mock('firebase/auth', () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
  signInAnonymously: jest.fn(),
  reauthenticateWithCredential: jest.fn(),
  EmailAuthProvider: { credential: jest.fn() },
}));
jest.mock('firebase/firestore', () => ({ getDoc: jest.fn(), doc: jest.fn() }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/storage', () => ({}));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getDoc as jest.Mock).mockResolvedValue({ data: () => ({ members: ['alice', 'bob'] }) });
});

test('la déconnexion révoque la session Firebase locale et retire la session de l’app', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  await clearSession();
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem('session')).toBeNull();
  expect(clearReminders).toHaveBeenCalledTimes(1);
});

test('un identifiant local ancien ne crée pas un nouveau compte anonyme', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'other', coupleId: 'couple' }));
  expect(await loadSession()).toBeNull();
  expect(signInAnonymously).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('session')).toBeNull();
});

test('un refus d’accès efface la session, une panne réseau la conserve pour réessayer', async () => {
  const raw = JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' });
  await AsyncStorage.setItem('session', raw);
  (getDoc as jest.Mock).mockRejectedValueOnce({ code: 'unavailable' });
  await expect(loadSession()).rejects.toEqual({ code: 'unavailable' });
  expect(await AsyncStorage.getItem('session')).toBe(raw);
  (getDoc as jest.Mock).mockRejectedValueOnce({ code: 'permission-denied' });
  expect(await loadSession()).toBeNull();
  expect(await AsyncStorage.getItem('session')).toBeNull();
});

test('un compte non anonyme ne lance pas une suppression sans confirmation du mot de passe', async () => {
  (firebase as jest.Mock).mockReturnValueOnce({ auth: { currentUser: { uid: 'alice', isAnonymous: false, email: 'a@example.test' } } });
  await expect(deleteMyAccount({ mode: 'cloud', userId: 'alice', coupleId: 'couple' } as Backend))
    .rejects.toThrow('Confirme ton mot de passe');
});
