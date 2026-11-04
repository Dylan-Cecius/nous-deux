import AsyncStorage from '@react-native-async-storage/async-storage';
import { reauthenticateWithCredential, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { firebase } from '../firebase';
import { deleteMyAccount, type Backend } from '../backend';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../firebase', () => ({ isFirebaseConfigured: true, firebase: jest.fn() }));
jest.mock('../photos', () => ({}));
jest.mock('../notifications', () => ({ clearReminders: jest.fn().mockResolvedValue(undefined) }));
jest.mock('firebase/auth', () => ({ signOut: jest.fn().mockResolvedValue(undefined), reauthenticateWithCredential: jest.fn(), EmailAuthProvider: { credential: jest.fn() } }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/storage', () => ({}));

const user = { uid: 'alice', isAnonymous: false, email: 'alice@example.test', getIdToken: jest.fn() };
const auth: { currentUser: typeof user | null } = { currentUser: user };
const backend = { mode: 'cloud', userId: 'alice', coupleId: 'couple' } as Backend;
const call = jest.fn();
beforeEach(async () => {
  jest.clearAllMocks();
  auth.currentUser = user;
  (firebase as jest.Mock).mockReturnValue({ auth, functions: {} });
  (reauthenticateWithCredential as jest.Mock).mockReset().mockResolvedValue(undefined);
  user.getIdToken.mockReset().mockResolvedValue('fictitious-token');
  call.mockReset().mockResolvedValue({ data: { status: 'complete' } });
  (httpsCallable as jest.Mock).mockReturnValue(call);
  await AsyncStorage.setItem('session', 'original-fictitious-session');
});

test.each(['reauth', 'token'])('un compte remplacé pendant %s ne lance aucune suppression serveur', async (stage) => {
  const change = async () => { auth.currentUser = { ...user, uid: 'bob' }; };
  if (stage === 'reauth') (reauthenticateWithCredential as jest.Mock).mockImplementationOnce(change);
  else user.getIdToken.mockImplementationOnce(change);
  await expect(deleteMyAccount(backend, 'fictitious-password')).rejects.toThrow('compte a changé');
  expect(call).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('session')).toBe('original-fictitious-session');
});

test('la requête de suppression est liée au compte confirmé', async () => {
  expect(await deleteMyAccount(backend, 'fictitious-password')).toBe('complete');
  expect(call).toHaveBeenCalledWith({ coupleId: 'couple', expectedUserId: 'alice' });
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem('session')).toBeNull();
});

test.each(['complete', 'pending'])('une réponse de suppression tardive (%s) ne déconnecte pas le nouveau compte', async (status) => {
  call.mockImplementationOnce(async () => {
    auth.currentUser = { ...user, uid: 'bob' };
    await AsyncStorage.setItem('session', 'new-fictitious-session');
    return { data: { status } };
  });
  await expect(deleteMyAccount(backend, 'fictitious-password')).rejects.toThrow('compte a changé');
  expect(signOut).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('session')).toBe('new-fictitious-session');
});

test('un mot de passe refusé ne déclenche pas de suppression', async () => {
  (reauthenticateWithCredential as jest.Mock).mockRejectedValueOnce({ code: 'auth/invalid-credential' });
  await expect(deleteMyAccount(backend, 'wrong-fictitious-password')).rejects.toThrow('incorrect');
  expect(call).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
});

test('le compte anonyme transmet également l’identité attendue sans réauthentification par e-mail', async () => {
  auth.currentUser = { ...user, isAnonymous: true };
  expect(await deleteMyAccount(backend)).toBe('complete');
  expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  expect(call).toHaveBeenCalledWith({ coupleId: 'couple', expectedUserId: 'alice' });
});

test('une suppression ayant invalidé Auth nettoie encore la session locale', async () => {
  call.mockImplementationOnce(async () => { auth.currentUser = null; return { data: { status: 'complete' } }; });
  expect(await deleteMyAccount(backend, 'fictitious-password')).toBe('complete');
  expect(await AsyncStorage.getItem('session')).toBeNull();
});
