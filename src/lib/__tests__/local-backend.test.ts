import type { Backend } from '../backend';
import type { AgendaEvent } from '../types';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../firebase', () => ({ isFirebaseConfigured: false, firebase: jest.fn() }));
jest.mock('../photos', () => ({ toCompactDataUri: jest.fn() }));
jest.mock('../notifications', () => ({ clearReminders: jest.fn() }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('firebase/functions', () => ({}));
jest.mock('firebase/storage', () => ({}));

let storage: typeof import('@react-native-async-storage/async-storage').default;
let backend: Backend;
beforeEach(async () => {
  jest.resetModules();
  storage = jest.requireMock('@react-native-async-storage/async-storage');
  await storage.clear();
  const { createLocalCouple } = jest.requireActual<typeof import('../backend')>('../backend');
  backend = await createLocalCouple({ name: 'Alice fictive', color: '#123456' }, { name: 'Bob fictif', color: '#abcdef' });
});
const read = async (key: string) => JSON.parse((await storage.getItem(key))!);
const note = (text: string) => ({ text, from: 'me', createdAt: 1 });
const event: Omit<AgendaEvent, 'id'> = { title: 'Horaire fictif', who: 'me', date: '2026-10-15', start: '09:00', end: '12:00', kind: 'travail', createdBy: 'me' };

test('deux ajouts simultanés à une collection sont tous deux conservés', async () => {
  await Promise.all([backend.add('notes', note('Premier')), backend.add('notes', note('Second'))]);
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Premier', 'Second']);
});

test('deux modifications indépendantes ne rétablissent pas les anciennes valeurs', async () => {
  await storage.setItem('local:col:notes', JSON.stringify([{ ...note('A'), id: 'a' }, { ...note('B'), id: 'b' }]));
  await Promise.all([backend.update('notes', 'a', { text: 'A modifié' }), backend.update('notes', 'b', { text: 'B modifié' })]);
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['A modifié', 'B modifié']);
});

test('un ajout concurrent ne ressuscite pas une entrée supprimée', async () => {
  await storage.setItem('local:col:notes', JSON.stringify([{ ...note('À retirer'), id: 'old' }]));
  await Promise.all([backend.remove('notes', 'old'), backend.add('notes', note('À garder'))]);
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['À garder']);
});

test('les modifications du couple et du profil se combinent', async () => {
  await Promise.all([backend.updateCouple({ since: '2020-01-01' }), backend.updateMember('me', { name: 'Alice modifiée' })]);
  const couple = await read('local:couple');
  expect(couple.since).toBe('2020-01-01');
  expect(couple.members[0].name).toBe('Alice modifiée');
  expect(couple.members[1].name).toBe('Bob fictif');
});

test('une série et un horaire indépendant ajoutés ensemble restent complets', async () => {
  await Promise.all([backend.addEvents([event, { ...event, date: '2026-10-22' }]), backend.add('events', { ...event, title: 'Autre horaire' })]);
  const events = await read('local:col:events');
  expect(events).toHaveLength(3);
  expect(new Set(events.map((x: { id: string }) => x.id)).size).toBe(3);
});

test('une écriture refusée ne bloque pas les suivantes et ne modifie pas le cache', async () => {
  (storage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Disque fictif plein'));
  const results = await Promise.allSettled([backend.add('notes', note('Refusé')), backend.add('notes', note('Conservé'))]);
  expect(results.map((x) => x.status)).toEqual(['rejected', 'fulfilled']);
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Conservé']);
  await backend.add('notes', note('Suivant'));
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Conservé', 'Suivant']);
});

test('une collection lente ne bloque pas les écritures des autres collections', async () => {
  let finish!: () => void;
  (storage.setItem as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const blocked = backend.add('notes', note('Lent'));
  for (let i = 0; i < 10 && !finish; i++) await Promise.resolve();
  expect(finish).toBeDefined();
  await backend.add('events', event);
  expect(await read('local:col:events')).toHaveLength(1);
  finish();
  await blocked;
});

test('une lecture initiale retardée ne remplace pas une écriture plus récente dans le cache', async () => {
  let finish!: (raw: string | null) => void;
  (storage.getItem as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const data = jest.fn();
  const stop = backend.subscribe('notes', data, jest.fn());
  await backend.add('notes', note('Premier'));
  finish(null);
  await Promise.resolve(); await Promise.resolve();
  expect(data).toHaveBeenCalledTimes(1);
  expect(data.mock.calls[0][0]).toEqual([expect.objectContaining({ text: 'Premier' })]);
  await backend.add('notes', note('Second'));
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Premier', 'Second']);
  stop();
});

test.each(['success', 'error'])('une lecture %s ne notifie plus après désabonnement', async (result) => {
  let resolve!: (raw: string | null) => void;
  let reject!: (error: Error) => void;
  (storage.getItem as jest.Mock).mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
  const data = jest.fn(); const error = jest.fn();
  const stop = backend.subscribe('notes', data, error);
  stop();
  if (result === 'success') resolve(null); else reject(new Error('Lecture fictive'));
  await Promise.resolve(); await Promise.resolve();
  expect(data).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

test('une erreur de lecture ancienne ne masque pas un résultat déjà confirmé', async () => {
  let reject!: (error: Error) => void;
  (storage.getItem as jest.Mock).mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; }));
  const data = jest.fn(); const error = jest.fn();
  const stop = backend.subscribe('notes', data, error);
  await backend.add('notes', note('Confirmé'));
  reject(new Error('Ancienne lecture'));
  await Promise.resolve(); await Promise.resolve();
  expect(error).not.toHaveBeenCalled();
  expect(data).toHaveBeenCalledTimes(1);
  stop();
});

test('une erreur initiale courante remonte et un nouvel abonnement peut reprendre', async () => {
  (storage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Lecture fictive'));
  const data = jest.fn(); const error = jest.fn();
  const stop = backend.subscribe('notes', data, error);
  await Promise.resolve(); await Promise.resolve();
  expect(error).toHaveBeenCalledTimes(1);
  expect(data).not.toHaveBeenCalled();
  stop();
  let retry!: () => void;
  await new Promise<void>((resolve) => { retry = backend.subscribe('notes', (items) => { data(items); resolve(); }, error); });
  expect(data).toHaveBeenCalledWith([]);
  retry();
});
