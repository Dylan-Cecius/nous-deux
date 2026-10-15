import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebase } from '../firebase';
import { createCloudCouple, joinCloudCouple } from '../backend';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../firebase', () => ({ isFirebaseConfigured: true, firebase: jest.fn() }));
jest.mock('../photos', () => ({}));
jest.mock('../notifications', () => ({ clearReminders: jest.fn() }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn() }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/storage', () => ({}));

const profile = { name: 'Alice fictive', color: '#abcdef' };
const newRaw = JSON.stringify({ mode: 'cloud', coupleId: 'bob-space', userId: 'bob' });
const auth: { currentUser: { uid: string } | null; authStateReady: jest.Mock } = { currentUser: { uid: 'alice' }, authStateReady: jest.fn() };
const mutation = jest.fn();
beforeEach(async () => {
  jest.clearAllMocks();
  auth.currentUser = { uid: 'alice' };
  (firebase as jest.Mock).mockReturnValue({ auth, db: {}, functions: {} });
  (getDoc as jest.Mock).mockReset().mockResolvedValue({ data: () => undefined });
  mutation.mockReset().mockResolvedValue({ data: { coupleId: 'alice-space' } });
  (httpsCallable as jest.Mock).mockReturnValue(mutation);
  await AsyncStorage.clear();
});

describe.each([
  ['createCouple', () => createCloudCouple(profile)],
  ['joinCouple', () => joinCloudCouple('ABCD-234567', profile)],
] as const)('%s lié à l’identité initiale', (name, enter) => {
  test('le serveur reçoit l’identité confirmée, sans changer le profil ni le code', async () => {
    const backend = await enter();
    expect(backend.userId).toBe('alice');
    expect(httpsCallable).toHaveBeenCalledWith({}, name);
    expect(mutation).toHaveBeenCalledWith({ expectedUserId: 'alice', profile, ...(name === 'joinCouple' ? { code: 'ABCD234567' } : {}) });
    expect(JSON.parse((await AsyncStorage.getItem('session'))!)).toEqual({ mode: 'cloud', coupleId: 'alice-space', userId: 'alice' });
  });

  test.each(['success', 'failure'])('une réponse %s tardive préserve la nouvelle session', async (outcome) => {
    mutation.mockImplementationOnce(async () => {
      auth.currentUser = { uid: 'bob' };
      await AsyncStorage.setItem('session', newRaw);
      if (outcome === 'failure') throw { code: 'functions/unavailable' };
      return { data: { coupleId: 'alice-space' } };
    });
    await expect(enter()).rejects.toThrow('compte a changé');
    expect(await AsyncStorage.getItem('session')).toBe(newRaw);
  });

  test('une déconnexion pendant la mutation ne rétablit pas un ancien backend', async () => {
    mutation.mockImplementationOnce(async () => {
      auth.currentUser = null;
      return { data: { coupleId: 'alice-space' } };
    });
    await expect(enter()).rejects.toThrow('compte a changé');
    expect(await AsyncStorage.getItem('session')).toBeNull();
  });

  test('un changement pendant la récupération bloque la mutation', async () => {
    (getDoc as jest.Mock).mockImplementationOnce(async () => {
      auth.currentUser = { uid: 'bob' };
      return { data: () => undefined };
    });
    await expect(enter()).rejects.toThrow('compte a changé');
    expect(mutation).not.toHaveBeenCalled();
  });

  test('une identité changée pendant la sauvegarde ne retourne pas l’ancien backend', async () => {
    const save = (AsyncStorage.setItem as jest.Mock).getMockImplementation();
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(async (...args) => {
      await save!(...args);
      auth.currentUser = { uid: 'bob' };
      await AsyncStorage.setItem('session', newRaw);
    });
    await expect(enter()).rejects.toThrow('compte a changé');
    expect(await AsyncStorage.getItem('session')).toBe(newRaw);
  });
});
