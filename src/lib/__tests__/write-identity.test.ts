import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, deleteDoc, runTransaction, updateDoc, writeBatch } from 'firebase/firestore';
import { loadSession, type Backend } from '../backend';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../firebase', () => ({ isFirebaseConfigured: true, firebase: () => ({ db: {}, functions: {}, auth: mockAuth }) }));
jest.mock('../photos', () => ({}));
jest.mock('../notifications', () => ({ clearReminders: jest.fn() }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/functions', () => ({ httpsCallable: () => mockCall }));
jest.mock('firebase/storage', () => ({}));
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'), collection: (_db: unknown, ...path: string[]) => path.join('/'),
  getDoc: jest.fn(async () => ({ data: () => ({ members: ['alice', 'bob'] }) })),
  addDoc: jest.fn(), deleteDoc: jest.fn(), updateDoc: jest.fn(), writeBatch: jest.fn(), runTransaction: jest.fn(), serverTimestamp: () => 'server-time',
}));

const mockAuth: { authStateReady: () => Promise<void>; currentUser: { uid: string } | null } = { authStateReady: async () => {}, currentUser: { uid: 'alice' } };
const mockCall = jest.fn();
let backend: Backend;
const batch = { set: jest.fn(), delete: jest.fn(), commit: jest.fn() };
const tx = { get: jest.fn(), delete: jest.fn() };
beforeEach(async () => {
  jest.clearAllMocks();
  mockAuth.currentUser = { uid: 'alice' };
  for (const fn of [addDoc, deleteDoc, updateDoc, batch.commit]) (fn as jest.Mock).mockReset().mockResolvedValue(undefined);
  mockCall.mockReset().mockResolvedValue({ data: {} });
  tx.get.mockReset().mockImplementation(async (ref) => ({ ref, data: () => ({ list: 'shopping', done: true }) }));
  (runTransaction as jest.Mock).mockReset().mockImplementation(async (_db, action) => action(tx));
  (writeBatch as jest.Mock).mockReturnValue(batch);
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  backend = (await loadSession())!;
});

const operations: [string, (b: Backend) => Promise<unknown>][] = [
  ['couple', (b) => b.updateCouple({ since: '2020-01-01' })],
  ['profil', (b) => b.updateMember('alice', { name: 'Alice fictive' })],
  ['ajout', (b) => b.add('items', { list: 'bucket', title: 'Envie fictive', done: false, createdBy: 'alice', createdAt: 1 })],
  ['réponse privée', (b) => b.add('answers', { date: '2026-10-15', from: 'alice', text: 'Réponse fictive', createdAt: 1 })],
  ['agenda groupé', (b) => b.addEvents([{ title: 'Fictif', date: '2026-10-15', start: '09:00', end: '10:00', who: 'alice', kind: 'perso', createdBy: 'alice' }])],
  ['suppression groupée', (b) => b.removeEvents(['one'])],
  ['panier', (b) => b.clearShoppingBasket(['one'])],
  ['modification', (b) => b.update('items', 'one', { title: 'Fictif' })],
  ['suppression', (b) => b.remove('items', 'one')],
  ['fonction', (b) => b.call('getInvitation', {})],
];

describe.each(operations)('%s', (_name, perform) => {
  test.each(['bob', null])('un ancien backend refuse l’identité %s avant toute requête', async (uid) => {
    mockAuth.currentUser = uid ? { uid } : null;
    await expect(perform(backend)).rejects.toThrow('compte a changé');
    for (const fn of [addDoc, deleteDoc, updateDoc, writeBatch, runTransaction, mockCall]) expect(fn).not.toHaveBeenCalled();
  });
  test('l’identité correspondante reste utilisable', async () => {
    await perform(backend);
    expect([addDoc, deleteDoc, updateDoc, writeBatch, runTransaction, mockCall].some((fn) => (fn as jest.Mock).mock.calls.length > 0)).toBe(true);
  });
});

test('le panier revalide aussi l’identité après la lecture transactionnelle', async () => {
  tx.get.mockImplementationOnce(async (ref) => {
    mockAuth.currentUser = { uid: 'bob' };
    return { ref, data: () => ({ list: 'shopping', done: true }) };
  });
  await expect(backend.clearShoppingBasket(['one'])).rejects.toThrow('compte a changé');
  expect(tx.delete).not.toHaveBeenCalled();
});

test('une nouvelle tentative de transaction après changement de compte ne relit rien', async () => {
  (runTransaction as jest.Mock).mockImplementationOnce(async (_db, action) => {
    mockAuth.currentUser = { uid: 'bob' };
    return action(tx);
  });
  await expect(backend.clearShoppingBasket(['one'])).rejects.toThrow('compte a changé');
  expect(tx.get).not.toHaveBeenCalled();
  expect(tx.delete).not.toHaveBeenCalled();
});
