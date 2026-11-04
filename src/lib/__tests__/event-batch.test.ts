import AsyncStorage from '@react-native-async-storage/async-storage';
import { writeBatch } from 'firebase/firestore';
import { loadSession, type Backend } from '../backend';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../firebase', () => ({ isFirebaseConfigured: true, firebase: () => ({ db: {}, auth: { authStateReady: jest.fn(), currentUser: { uid: 'alice' } } }) }));
jest.mock('../photos', () => ({}));
jest.mock('../notifications', () => ({ clearReminders: jest.fn() }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/functions', () => ({}));
jest.mock('firebase/storage', () => ({}));
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'), collection: jest.fn(),
  getDoc: jest.fn(async () => ({ data: () => ({ members: ['alice', 'bob'] }) })), writeBatch: jest.fn(),
}));

let backend: Backend;
const batch = { delete: jest.fn(), commit: jest.fn() };
beforeEach(async () => {
  jest.clearAllMocks();
  batch.commit.mockReset().mockResolvedValue(undefined);
  (writeBatch as jest.Mock).mockReturnValue(batch);
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  backend = (await loadSession())!;
});

test('les 52 suppressions sont dédupliquées et envoyées dans un seul lot du couple courant', async () => {
  const ids = Array.from({ length: 52 }, (_, i) => `event-${i}`);
  await backend.removeEvents([...ids, ids[0]]);
  expect(writeBatch).toHaveBeenCalledTimes(1);
  expect(batch.delete.mock.calls).toEqual(ids.map((id) => [`couples/couple/events/${id}`]));
  expect(batch.commit).toHaveBeenCalledTimes(1);
});

test('un refus du serveur remonte sans fractionner ni répéter le lot', async () => {
  batch.commit.mockRejectedValueOnce(new Error('Refus fictif'));
  await expect(backend.removeEvents(['one', 'two'])).rejects.toThrow('Refus fictif');
  expect(batch.commit).toHaveBeenCalledTimes(1);
  expect(batch.delete).toHaveBeenCalledTimes(2);
});

test.each([Array.from({ length: 53 }, (_, i) => `${i}`), [''], ['a/b']].map((ids) => [ids]))('un lot invalide est refusé avant de créer le batch : %j', async (ids) => {
  await expect(backend.removeEvents(ids)).rejects.toThrow();
  expect(writeBatch).not.toHaveBeenCalled();
});

test('un lot vide ne contacte pas Firebase', async () => {
  await backend.removeEvents([]);
  expect(writeBatch).not.toHaveBeenCalled();
});
