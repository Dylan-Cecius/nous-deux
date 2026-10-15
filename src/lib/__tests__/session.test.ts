import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import { getDoc, onSnapshot } from 'firebase/firestore';
import { clearSession, loadSession, signInWithEmail, deleteMyAccount, type Backend } from '../backend';
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
  signInWithEmailAndPassword: jest.fn(),
  reauthenticateWithCredential: jest.fn(),
  EmailAuthProvider: { credential: jest.fn() },
}));
jest.mock('firebase/firestore', () => ({ getDoc: jest.fn(), doc: jest.fn(), collection: jest.fn(), onSnapshot: jest.fn(() => jest.fn()) }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/storage', () => ({}));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getDoc as jest.Mock).mockReset().mockResolvedValue({ data: () => ({ members: ['alice', 'bob'] }) });
  (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'alice' } });
});

test('une erreur de collection est transmise sans émettre une fausse liste vide', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  const backend = (await loadSession())!;
  const data = jest.fn();
  const error = jest.fn();
  backend.subscribe('expenses', data, error);
  (onSnapshot as jest.Mock).mock.calls[0][2]({ code: 'permission-denied' });
  expect(error).toHaveBeenCalledWith({ code: 'permission-denied' });
  expect(data).not.toHaveBeenCalled();
});

test('une erreur de réponses arrête les trois flux sans résultat partiel ultérieur', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  const backend = (await loadSession())!;
  const data = jest.fn();
  const error = jest.fn();
  const stop = backend.subscribe('answers', data, error);
  (onSnapshot as jest.Mock).mock.calls[0][2]({ code: 'permission-denied' });
  for (const call of (onSnapshot as jest.Mock).mock.calls) call[1]({ docs: [] });
  expect(error).toHaveBeenCalledTimes(1);
  expect(data).not.toHaveBeenCalled();
  for (const result of (onSnapshot as jest.Mock).mock.results) expect(result.value).toHaveBeenCalledTimes(1);
  stop();
  for (const result of (onSnapshot as jest.Mock).mock.results) expect(result.value).toHaveBeenCalledTimes(1);
});

test('les réponses fusionnent toujours mes textes, les révélations et les statuts sans texte privé du partenaire', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  const backend = (await loadSession())!;
  const data = jest.fn();
  const error = jest.fn();
  const stop = backend.subscribe('answers', data, error);
  const answer = { date: '2026-10-15', from: 'alice', text: 'Réponse de test', createdAt: 1 };
  const revealed = { date: '2026-10-14', from: 'bob', text: 'Réponse révélée de test', createdAt: 1 };
  (onSnapshot as jest.Mock).mock.calls[0][1]({ docs: [{ id: 'own', data: () => answer }] });
  (onSnapshot as jest.Mock).mock.calls[1][1]({ docs: [{ id: 'revealed', data: () => revealed }] });
  (onSnapshot as jest.Mock).mock.calls[2][1]({ docs: [{ data: () => ({ date: '2026-10-15', responded: ['alice', 'bob'] }) }] });
  const items = data.mock.calls.at(-1)![0];
  expect(items).toHaveLength(3);
  expect(items).toEqual(expect.arrayContaining([
    { ...answer, id: 'own' }, { ...revealed, id: 'revealed' },
    { id: '2026-10-15_bob', date: '2026-10-15', from: 'bob', text: '', createdAt: 0 },
  ]));
  expect(error).not.toHaveBeenCalled();
  stop();
});

test('une erreur de collection locale ne devient pas une liste vide', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'local' }));
  const backend = (await loadSession())!;
  const error = new Error('Stockage indisponible');
  (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(error);
  const onData = jest.fn();
  const onError = jest.fn();
  const stop = backend.subscribe('expenses', onData, onError);
  await Promise.resolve();
  await Promise.resolve();
  expect(onError).toHaveBeenCalledWith(error);
  expect(onData).not.toHaveBeenCalled();
  stop();
});

test('la reconnexion vérifie le couple avant d’enregistrer la session', async () => {
  (getDoc as jest.Mock)
    .mockResolvedValueOnce({ data: () => ({ coupleId: 'recovered' }) })
    .mockResolvedValueOnce({ data: () => ({ members: ['alice', 'bob'] }) });
  const backend = await signInWithEmail(' alice@example.test ', 'test-password');
  expect(backend.coupleId).toBe('recovered');
  expect(getDoc).toHaveBeenCalledTimes(2);
  expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'alice@example.test', 'test-password');
  expect(JSON.parse((await AsyncStorage.getItem('session'))!)).toEqual({ mode: 'cloud', userId: 'alice', coupleId: 'recovered' });
});

test.each([undefined, { members: ['bob'] }])('un ancien rattachement ne valide pas une session inaccessible : %p', async (couple) => {
  (getDoc as jest.Mock)
    .mockResolvedValueOnce({ data: () => ({ coupleId: 'old-space' }) })
    .mockResolvedValueOnce({ data: () => couple });
  await expect(signInWithEmail('alice@example.test', 'test-password')).rejects.toThrow('accès à cet espace');
  expect(await AsyncStorage.getItem('session')).toBeNull();
  expect(signOut).not.toHaveBeenCalled();
  expect(signInAnonymously).not.toHaveBeenCalled();
});

test.each(['unavailable', 'permission-denied'])(
  'un échec de lecture du couple reste explicite et permet de réessayer : %s', async (code) => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ data: () => ({ coupleId: 'recovered' }) })
      .mockRejectedValueOnce({ code });
    await expect(signInWithEmail('alice@example.test', 'test-password')).rejects.toThrow(
      code === 'unavailable' ? 'Vérifie ta connexion' : 'accès à cet espace',
    );
    expect(await AsyncStorage.getItem('session')).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ data: () => ({ coupleId: 'recovered' }) })
      .mockResolvedValueOnce({ data: () => ({ members: ['alice'] }) });
    expect((await signInWithEmail('alice@example.test', 'test-password')).coupleId).toBe('recovered');
    expect(signInAnonymously).not.toHaveBeenCalled();
  },
);

test('la déconnexion révoque la session Firebase locale et retire la session de l’app', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  await clearSession();
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem('session')).toBeNull();
  expect(clearReminders).toHaveBeenCalledTimes(1);
});

test('une erreur d’abonnement est signalée sans prétendre que le couple est vide', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  const backend = (await loadSession())!;
  const onData = jest.fn();
  const onError = jest.fn();
  backend.subscribeCouple(onData, onError);
  const error = { code: 'permission-denied' };
  (onSnapshot as jest.Mock).mock.calls[0][2](error);
  expect(onError).toHaveBeenCalledWith(error);
  expect(onData).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
});

test('une lecture locale échouée remonte aussi une erreur récupérable', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'local' }));
  const backend = (await loadSession())!;
  const error = new Error('Stockage temporairement indisponible');
  (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(error);
  const onData = jest.fn();
  const onError = jest.fn();
  const stop = backend.subscribeCouple(onData, onError);
  await Promise.resolve();
  await Promise.resolve();
  expect(onError).toHaveBeenCalledWith(error);
  expect(onData).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('session')).not.toBeNull();
  stop();
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

test('une migration répare une ancienne session grâce à l’index serveur sans déconnexion', async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'old-empty' }));
  (getDoc as jest.Mock)
    .mockResolvedValueOnce({ data: () => ({ coupleId: 'recovered' }) })
    .mockResolvedValueOnce({ data: () => ({ members: ['alice'] }) });
  expect((await loadSession())?.coupleId).toBe('recovered');
  expect(JSON.parse((await AsyncStorage.getItem('session'))!).coupleId).toBe('recovered');
  expect(signOut).not.toHaveBeenCalled();
  expect(signInAnonymously).not.toHaveBeenCalled();
});
