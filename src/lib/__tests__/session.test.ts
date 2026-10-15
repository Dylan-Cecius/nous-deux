import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut, signInAnonymously, signInWithEmailAndPassword, linkWithCredential } from 'firebase/auth';
import { getDoc, onSnapshot } from 'firebase/firestore';
import { clearSession, loadSession, signInWithEmail, deleteMyAccount, createCloudCouple, joinCloudCouple, secureAccount, type Backend } from '../backend';
import { httpsCallable } from 'firebase/functions';
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
  linkWithCredential: jest.fn(),
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

const profile = { name: 'Alice fictive', color: '#abcdef' };

test('une sécurisation en attente ne lie pas l’e-mail à un autre compte', async () => {
  const auth = { authStateReady: jest.fn(), currentUser: { uid: 'alice' } };
  const original = (firebase as jest.Mock).getMockImplementation();
  (firebase as jest.Mock).mockReturnValue({ auth, db: {} });
  let release!: () => void; let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  (signInWithEmailAndPassword as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
    release = () => { auth.currentUser = { uid: 'bob' }; resolve({ user: auth.currentUser }); }; started();
  }));
  (getDoc as jest.Mock).mockResolvedValue({ data: () => ({ coupleId: 'other', members: ['bob'] }) });
  try {
    const entering = signInWithEmail('bob@example.test', 'fictitious-password');
    await entered;
    const securing = secureAccount('alice@example.test', 'fictitious-password');
    const result = Promise.allSettled([entering, securing]);
    release();
    expect((await result).map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(linkWithCredential).not.toHaveBeenCalled();
  } finally { (firebase as jest.Mock).mockImplementation(original); }
});
const onboard = [
  ['création', () => createCloudCouple(profile)],
  ['invitation', () => joinCloudCouple('ABCD234567', profile)],
] as const;

describe.each(onboard)('récupération après %s', (_name, enter) => {
  test('deux demandes concurrentes ne créent ou ne consomment qu’une fois', async () => {
    let created = false;
    (getDoc as jest.Mock).mockImplementation(() => Promise.resolve({ data: () => created ? { coupleId: 'recovered', members: ['alice'] } : undefined }));
    const call = jest.fn(async () => {
      if (created) throw { code: 'functions/failed-precondition', message: 'Déjà utilisé' };
      created = true;
      return { data: { coupleId: 'recovered' } };
    });
    (httpsCallable as jest.Mock).mockReturnValue(call);
    const results = await Promise.all([enter(), enter()]);
    expect(results.map((backend) => backend.coupleId)).toEqual(['recovered', 'recovered']);
    expect(call).toHaveBeenCalledTimes(1);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  test.each(['stockage', 'réponse'])('une panne de %s après succès serveur ne relance pas l’opération', async (failure) => {
    let created = false;
    (getDoc as jest.Mock).mockImplementation(() => Promise.resolve({ data: () => created ? { coupleId: 'recovered', members: ['alice', 'bob'] } : undefined }));
    const call = jest.fn(async () => {
      if (created) throw { code: 'functions/failed-precondition', message: 'Code utilisé ou espace déjà créé' };
      created = true;
      if (failure === 'réponse') throw { code: 'functions/unavailable' };
      return { data: { coupleId: 'recovered' } };
    });
    (httpsCallable as jest.Mock).mockReturnValue(call);
    if (failure === 'stockage') (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Stockage fictif indisponible'));
    await expect(enter()).rejects.toThrow();
    expect(await AsyncStorage.getItem('session')).toBeNull();
    expect((await enter()).coupleId).toBe('recovered');
    expect(call).toHaveBeenCalledTimes(1);
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem('session'))!)).toEqual({ mode: 'cloud', userId: 'alice', coupleId: 'recovered' });
  });

  test('un nouvel utilisateur garde le parcours de création ou d’acceptation', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ data: () => undefined });
    const call = jest.fn().mockResolvedValue({ data: { coupleId: 'new-space' } });
    (httpsCallable as jest.Mock).mockReturnValue(call);
    expect((await enter()).coupleId).toBe('new-space');
    expect(call).toHaveBeenCalledTimes(1);
  });

  test('une lecture impossible ne crée pas un nouvel espace ni une autre identité', async () => {
    (getDoc as jest.Mock).mockRejectedValueOnce({ code: 'unavailable' });
    const call = jest.fn().mockResolvedValue({ data: { coupleId: 'wrong' } });
    (httpsCallable as jest.Mock).mockReturnValue(call);
    await expect(enter()).rejects.toThrow('Vérifie ta connexion');
    expect(call).not.toHaveBeenCalled();
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('session')).toBeNull();
  });

  test('un index existant sans appartenance vérifiée reste refusé', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ data: () => ({ coupleId: 'foreign' }) }).mockResolvedValueOnce({ data: () => ({ members: ['bob'] }) });
    const call = jest.fn().mockResolvedValue({ data: { coupleId: 'wrong' } });
    (httpsCallable as jest.Mock).mockReturnValue(call);
    await expect(enter()).rejects.toThrow('accès à cet espace');
    expect(call).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('session')).toBeNull();
  });
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

test.each([0, 1, 2])('une erreur du flux de réponses %i arrête les trois flux sans résultat partiel ultérieur', async (failed) => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  const backend = (await loadSession())!;
  const data = jest.fn();
  const error = jest.fn();
  const stop = backend.subscribe('answers', data, error);
  (onSnapshot as jest.Mock).mock.calls[(failed + 1) % 3][1]({ docs: [] });
  (onSnapshot as jest.Mock).mock.calls[failed][2]({ code: 'permission-denied' });
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

test.each([[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]])(
  'les réponses attendent les trois premiers résultats, ordre %i/%i/%i', async (first, second, third) => {
    await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
    const backend = (await loadSession())!;
    const data = jest.fn();
    const stop = backend.subscribe('answers', data, jest.fn());
    const calls = (onSnapshot as jest.Mock).mock.calls;
    calls[first][1]({ docs: [] });
    calls[first][1]({ docs: [] });
    calls[second][1]({ docs: [] });
    expect(data).not.toHaveBeenCalled();
    calls[third][1]({ docs: [] });
    expect(data).toHaveBeenCalledTimes(1);
    expect(data).toHaveBeenLastCalledWith([]);
    calls[first][1]({ docs: [] });
    expect(data).toHaveBeenCalledTimes(2);
    stop();
  },
);

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
