import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import storage from '@react-native-async-storage/async-storage';
import { createLocalCouple, deleteMyAccount, type Backend } from '../backend';
import { CoupleProvider, useCollectionState, useCouple } from '../couple-context';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../firebase', () => ({ isFirebaseConfigured: false, firebase: jest.fn() }));
jest.mock('../photos', () => ({ toCompactDataUri: jest.fn() }));
jest.mock('../notifications', () => ({ clearReminders: jest.fn().mockResolvedValue(undefined) }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('firebase/functions', () => ({}));
jest.mock('firebase/storage', () => ({}));
jest.mock('@/constants/theme', () => ({ BothColor: '#000000' }));

let root: ReactTestRenderer;
let backend: Backend;
let collection!: ReturnType<typeof useCollectionState<'notes'>>;
let session!: ReturnType<typeof useCouple>;
function Consumer() {
  const notes = useCollectionState('notes');
  const couple = useCouple();
  useEffect(() => { collection = notes; session = couple; });
  return null;
}
beforeEach(async () => {
  jest.replaceProperty(jest.requireActual('react-native').Platform, 'OS', 'web');
  await storage.clear();
  backend = await createLocalCouple({ name: 'Alice fictive', color: '#123456' }, { name: 'Bob fictif', color: '#abcdef' });
  await backend.add('notes', { text: 'Initial', from: 'me', createdAt: 1 });
  await act(async () => { root = create(<CoupleProvider><Consumer /></CoupleProvider>); });
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  await deleteMyAccount(backend);
  jest.restoreAllMocks();
});
const ambiguousWrite = () => {
  const write = (storage.setItem as jest.Mock).getMockImplementation()!;
  (storage.setItem as jest.Mock).mockImplementationOnce(async (key, value) => {
    await write(key, value);
    throw new Error('Confirmation perdue fictive');
  });
};

test('la collection réelle signale le résultat incertain puis relit la donnée enregistrée à la reprise', async () => {
  expect(collection.items.map(n => n.text)).toEqual(['Initial']);
  ambiguousWrite();
  await act(async () => {
    await expect(backend.add('notes', { text: 'Confirmé sur disque', from: 'me', createdAt: 2 })).rejects.toThrow('Confirmation perdue');
  });
  expect(collection.error).toBe(true);
  expect(collection.loading).toBe(false);
  expect(collection.items).toEqual([]);
  await act(async () => { collection.retry(); });
  expect(collection.error).toBe(false);
  expect(collection.items.map(n => n.text)).toEqual(['Initial', 'Confirmé sur disque']);
});

test('un refus sans écriture conserve les données et la reprise ne fabrique pas un ajout', async () => {
  (storage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Disque fictif plein'));
  await act(async () => {
    await expect(backend.add('notes', { text: 'Non écrit', from: 'me', createdAt: 2 })).rejects.toThrow('Disque fictif plein');
  });
  expect(collection.error).toBe(true);
  await act(async () => { collection.retry(); });
  expect(collection.error).toBe(false);
  expect(collection.items.map(n => n.text)).toEqual(['Initial']);
});

test('le couple devient indisponible après rejet puis retrouve son profil réellement enregistré', async () => {
  ambiguousWrite();
  await act(async () => {
    await expect(backend.updateMember('me', { name: 'Profil modifié fictif' })).rejects.toThrow('Confirmation perdue');
  });
  expect(session.syncError).toBe(true);
  expect(session.couple).toBeNull();
  expect(collection.error).toBe(false);
  await act(async () => { session.retrySync(); });
  expect(session.syncError).toBe(false);
  expect(session.couple?.members[0].name).toBe('Profil modifié fictif');
});
