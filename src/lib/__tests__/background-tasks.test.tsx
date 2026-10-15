import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BackgroundTasks } from '@/components/background-tasks';
import { celebrate } from '@/components/celebrate';
import { useCollectionState, useSession } from '../couple-context';
import { getPushToken } from '../notifications';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return { useCollection: (name: string) => state(name).items, useCollectionState: state, useSession: jest.fn() };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../notifications', () => ({ getPushToken: jest.fn(), scheduleCountdownReminders: jest.fn(() => Promise.resolve()) }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('@/components/celebrate', () => ({ celebrate: jest.fn() }));

let root: ReactTestRenderer;
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const ping = (createdAt: number) => ({ id: `ping-${createdAt}`, kind: 'ping', from: 'bob', text: '💗', createdAt });
const backend = { mode: 'local', userId: 'alice', coupleId: 'first', call: jest.fn() };
const session = { backend, me: { id: 'alice' }, partner: { name: 'Bob' } };
const notesAt = (createdAt: number) => (useCollectionState as jest.Mock).mockImplementation((name) => name === 'notes' ? { ...ready, items: [ping(createdAt)] } : ready);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};
beforeEach(() => {
  jest.clearAllMocks();
  (useSession as jest.Mock).mockReturnValue(session);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  (AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue('100');
  (AsyncStorage.setItem as jest.Mock).mockReset().mockResolvedValue(undefined);
  (getPushToken as jest.Mock).mockReset().mockResolvedValue(null);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test('un changement d’espace attend son propre marqueur avant d’annoncer un cœur', async () => {
  await act(async () => { root = create(<BackgroundTasks />); });
  const marker = deferred<string>();
  (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(marker.promise);
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, coupleId: 'second' } });
  notesAt(200);
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(celebrate).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await act(async () => { marker.resolve('300'); });
  expect(celebrate).not.toHaveBeenCalled();
});

test('la lecture tardive de l’ancien espace ne remplace pas le marqueur courant', async () => {
  const old = deferred<string>();
  (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(old.promise).mockResolvedValueOnce('300');
  await act(async () => { root = create(<BackgroundTasks />); });
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, coupleId: 'second' } });
  notesAt(200);
  await act(async () => { root.update(<BackgroundTasks />); });
  await act(async () => { old.resolve('10'); });
  notesAt(250);
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(celebrate).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test.each(['loading', 'error'])('les cœurs en %s ne sont pas marqués comme vus ni célébrés', async (status) => {
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'notes' ? { ...ready, items: [ping(200)], [status]: true } : ready);
  await act(async () => { root = create(<BackgroundTasks />); });
  expect(celebrate).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  notesAt(200);
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(celebrate).toHaveBeenCalledTimes(1);
});

test('la première ouverture ne rejoue pas les anciens cœurs, puis un cœur neuf est annoncé une fois', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
  notesAt(200);
  await act(async () => { root = create(<BackgroundTasks />); });
  expect(celebrate).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('seen:ping:first', '200');
  notesAt(300);
  await act(async () => { root.update(<BackgroundTasks />); });
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(celebrate).toHaveBeenCalledTimes(1);
  expect(celebrate).toHaveBeenCalledWith('hearts', 'Bob pense à toi 💗');
});

test.each(['illisible', 'NaN', '-1'])('un marqueur local invalide (%s) ne rejoue pas l’historique', async (value) => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(value);
  notesAt(200);
  await act(async () => { root = create(<BackgroundTasks />); });
  expect(celebrate).not.toHaveBeenCalled();
});

test('une erreur de lecture locale ne marque rien comme vu et ne rejoue pas les cœurs', async () => {
  (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Stockage indisponible'));
  notesAt(200);
  await act(async () => { root = create(<BackgroundTasks />); });
  expect(celebrate).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('une erreur d’écriture locale ne provoque ni rejet non géré ni répétition dans la session', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Écriture indisponible'));
  notesAt(200);
  await act(async () => { root = create(<BackgroundTasks />); });
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(celebrate).toHaveBeenCalledTimes(1);
});

test.each(['changement', 'fermeture'])('un jeton push tardif n’est pas envoyé à l’ancien contexte après %s', async (change) => {
  const token = deferred<string>();
  (getPushToken as jest.Mock).mockReturnValueOnce(token.promise);
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, mode: 'cloud' } });
  await act(async () => { root = create(<BackgroundTasks />); });
  if (change === 'fermeture') await act(async () => { root.unmount(); });
  else {
    (useSession as jest.Mock).mockReturnValue(session);
    await act(async () => { root.update(<BackgroundTasks />); });
  }
  await act(async () => { token.resolve('jeton-fictif'); });
  expect(backend.call).not.toHaveBeenCalled();
});

test('un jeton obtenu pour le contexte encore actif est bien enregistré', async () => {
  (getPushToken as jest.Mock).mockResolvedValueOnce('jeton-fictif');
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, mode: 'cloud' } });
  await act(async () => { root = create(<BackgroundTasks />); });
  expect(backend.call).toHaveBeenCalledTimes(1);
  expect(backend.call).toHaveBeenCalledWith('registerPushToken', { token: 'jeton-fictif' });
});

test('changer de membre dans le même espace réinitialise aussi la lecture du marqueur', async () => {
  await act(async () => { root = create(<BackgroundTasks />); });
  const marker = deferred<string>();
  (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(marker.promise);
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: 'bob' }, me: { id: 'bob' }, partner: { name: 'Alice' } });
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'notes' ? { ...ready, items: [{ ...ping(200), from: 'alice' }] } : ready);
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(celebrate).not.toHaveBeenCalled();
  await act(async () => { marker.resolve('300'); });
  expect(celebrate).not.toHaveBeenCalled();
});
