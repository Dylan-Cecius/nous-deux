import AsyncStorage from '@react-native-async-storage/async-storage';
import { runTransaction } from 'firebase/firestore';
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
  getDoc: jest.fn(async () => ({ data: () => ({ members: ['alice', 'bob'] }) })), runTransaction: jest.fn(),
}));

let backend: Backend;
const tx = { get: jest.fn(), delete: jest.fn() };
beforeEach(async () => {
  jest.clearAllMocks();
  tx.get.mockReset().mockImplementation(async (ref) => ({ ref, data: () => ({ list: 'shopping', done: true }) }));
  (runTransaction as jest.Mock).mockReset().mockImplementation(async (_db, action) => action(tx));
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  backend = (await loadSession())!;
});

test('100 articles sont relus avant toute suppression dans une transaction unique, doublons ignorés', async () => {
  const ids = Array.from({ length: 100 }, (_, i) => `item-${i}`);
  await backend.clearShoppingBasket([...ids, ids[0]]);
  expect(runTransaction).toHaveBeenCalledTimes(1);
  expect(tx.get.mock.calls).toEqual(ids.map((id) => [`couples/couple/items/${id}`]));
  expect(tx.delete.mock.calls).toEqual(tx.get.mock.calls);
  expect(Math.max(...tx.get.mock.invocationCallOrder)).toBeLessThan(Math.min(...tx.delete.mock.invocationCallOrder));
});

test('les articles décochés, déplacés ou déjà absents sont conservés', async () => {
  const states = [{ list: 'shopping', done: false }, { list: 'films', done: true }, undefined, { list: 'shopping', done: true }];
  tx.get.mockImplementation(async (ref) => ({ ref, data: () => states.shift() }));
  await backend.clearShoppingBasket(['unchecked', 'film', 'missing', 'remove']);
  expect(tx.delete.mock.calls).toEqual([['couples/couple/items/remove']]);
});

test('une lecture refusée ne lance aucune suppression', async () => {
  tx.get.mockRejectedValueOnce(new Error('Lecture fictive refusée'));
  await expect(backend.clearShoppingBasket(['one', 'two'])).rejects.toThrow('Lecture fictive refusée');
  expect(tx.delete).not.toHaveBeenCalled();
});

test('un commit refusé remonte sans fractionner la transaction', async () => {
  (runTransaction as jest.Mock).mockImplementationOnce(async (_db, action) => { await action(tx); throw new Error('Commit fictif refusé'); });
  await expect(backend.clearShoppingBasket(['one', 'two'])).rejects.toThrow('Commit fictif refusé');
  expect(runTransaction).toHaveBeenCalledTimes(1);
});

test.each([Array.from({ length: 101 }, (_, i) => `${i}`), [''], ['a/b']].map((ids) => [ids]))('une sélection invalide est refusée sans contacter Firebase : %j', async (ids) => {
  await expect(backend.clearShoppingBasket(ids)).rejects.toThrow();
  expect(runTransaction).not.toHaveBeenCalled();
});

test('une sélection vide ne contacte pas Firebase', async () => {
  await backend.clearShoppingBasket([]);
  expect(runTransaction).not.toHaveBeenCalled();
});
