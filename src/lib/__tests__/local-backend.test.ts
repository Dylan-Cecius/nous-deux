import type { Backend } from '../backend';
import type { AgendaEvent } from '../types';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../firebase', () => ({ isFirebaseConfigured: false, firebase: jest.fn() }));
jest.mock('../photos', () => ({ toCompactDataUri: jest.fn() }));
jest.mock('../notifications', () => ({ clearReminders: jest.fn().mockResolvedValue(undefined) }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('firebase/functions', () => ({}));
jest.mock('firebase/storage', () => ({}));

let storage: typeof import('@react-native-async-storage/async-storage').default;
let backend: Backend;
let api: typeof import('../backend');
beforeEach(async () => {
  jest.resetModules();
  jest.replaceProperty(jest.requireActual('react-native').Platform, 'OS', 'web');
  storage = jest.requireMock('@react-native-async-storage/async-storage');
  await storage.clear();
  api = jest.requireActual<typeof import('../backend')>('../backend');
  backend = await api.createLocalCouple({ name: 'Alice fictive', color: '#123456' }, { name: 'Bob fictif', color: '#abcdef' });
});
afterEach(() => { jest.restoreAllMocks(); });
const read = async (key: string) => JSON.parse((await storage.getItem(key))!);
const note = (text: string) => ({ text, from: 'me', createdAt: 1 });
const event: Omit<AgendaEvent, 'id'> = { title: 'Horaire fictif', who: 'me', date: '2026-10-15', start: '09:00', end: '12:00', kind: 'travail', createdBy: 'me' };

const commitThenReject = () => {
  const write = (storage.setItem as jest.Mock).getMockImplementation()!;
  (storage.setItem as jest.Mock).mockImplementationOnce(async (key, value) => {
    await write(key, value);
    throw new Error('Confirmation perdue fictive');
  });
};

test('un ajout enregistré malgré son rejet est conservé par l’écriture suivante', async () => {
  await backend.add('notes', note('Initial'));
  commitThenReject();
  const results = await Promise.allSettled([backend.add('notes', note('Ambigu')), backend.add('notes', note('Suivant'))]);
  expect(results.map(r => r.status)).toEqual(['rejected', 'fulfilled']);
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Initial', 'Ambigu', 'Suivant']);
});

test('une lecture commencée avant une écriture ambiguë ne repeuple pas le cache ancien', async () => {
  let finish!: (raw: string | null) => void;
  (storage.getItem as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const data = jest.fn(); const error = jest.fn();
  const stop = backend.subscribe('notes', data, error);
  commitThenReject();
  await expect(backend.add('notes', note('Ambigu'))).rejects.toThrow('Confirmation perdue');
  finish(null);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(data).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledTimes(1);
  await backend.add('notes', note('Suivant'));
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Ambigu', 'Suivant']);
  stop();
});

test('une écriture ambiguë ne périme pas la lecture d’une autre collection', async () => {
  let finish!: (raw: string | null) => void;
  (storage.getItem as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const data = jest.fn(); const error = jest.fn();
  const stop = backend.subscribe('events', data, error);
  commitThenReject();
  await expect(backend.add('notes', note('Ambigu'))).rejects.toThrow('Confirmation perdue');
  finish(JSON.stringify([{ ...event, id: 'one' }]));
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(data).toHaveBeenCalledWith([{ ...event, id: 'one' }]);
  expect(error).not.toHaveBeenCalled();
  stop();
});

test('une suppression enregistrée malgré son rejet ne ressuscite pas au prochain ajout', async () => {
  await backend.add('notes', note('À retirer'));
  const [entry] = await read('local:col:notes');
  commitThenReject();
  await expect(backend.remove('notes', entry.id)).rejects.toThrow('Confirmation perdue');
  await backend.add('notes', note('Conservé'));
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Conservé']);
});

test('un profil enregistré malgré son rejet est conservé lors de la modification du couple', async () => {
  commitThenReject();
  await expect(backend.updateMember('me', { name: 'Modifié' })).rejects.toThrow('Confirmation perdue');
  await backend.updateCouple({ since: '2020-01-01' });
  expect((await read('local:couple')).members[0].name).toBe('Modifié');
});

test('une relecture impossible après rejet ne permet pas une écriture fondée sur le cache ancien', async () => {
  await backend.add('notes', note('Initial'));
  commitThenReject();
  await expect(backend.add('notes', note('Ambigu'))).rejects.toThrow('Confirmation perdue');
  (storage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Relecture impossible fictive'));
  await expect(backend.add('notes', note('À bloquer'))).rejects.toThrow('Relecture impossible');
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Initial', 'Ambigu']);
});

test('vider le panier ne retire que les courses sélectionnées encore cochées en une écriture', async () => {
  const entries = [{ id: 'remove', list: 'shopping', done: true }, { id: 'unchecked', list: 'shopping', done: false }, { id: 'film', list: 'films', done: true }, { id: 'unselected', list: 'shopping', done: true }];
  await storage.setItem('local:col:items', JSON.stringify(entries));
  (storage.setItem as jest.Mock).mockClear();
  await backend.clearShoppingBasket(['remove', 'remove', 'unchecked', 'film', 'missing']);
  expect(await read('local:col:items')).toEqual(entries.slice(1));
  expect(storage.setItem).toHaveBeenCalledTimes(1);
});

test('un panier ne peut pas être supprimé partiellement si le stockage refuse l’écriture', async () => {
  const entries = [{ id: 'one', list: 'shopping', done: true }, { id: 'two', list: 'shopping', done: true }];
  await storage.setItem('local:col:items', JSON.stringify(entries));
  (storage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Disque fictif plein'));
  await expect(backend.clearShoppingBasket(['one', 'two'])).rejects.toThrow('Disque fictif plein');
  expect(await read('local:col:items')).toEqual(entries);
  await backend.clearShoppingBasket(['one']);
  expect(await read('local:col:items')).toEqual([entries[1]]);
});

test('vider le panier relit un article décoché par une opération locale déjà engagée', async () => {
  await storage.setItem('local:col:items', JSON.stringify([{ id: 'one', list: 'shopping', done: true }]));
  await Promise.all([backend.update('items', 'one', { done: false }), backend.clearShoppingBasket(['one'])]);
  expect(await read('local:col:items')).toEqual([{ id: 'one', list: 'shopping', done: false }]);
});

test('un panier trop grand ou vide ne touche pas au stockage', async () => {
  (storage.setItem as jest.Mock).mockClear();
  await expect(backend.clearShoppingBasket(Array.from({ length: 101 }, (_, i) => `${i}`))).rejects.toThrow('100');
  await backend.clearShoppingBasket([]);
  expect(storage.setItem).not.toHaveBeenCalled();
});

test('un refus de suppression groupée conserve tous les horaires et le cache', async () => {
  await backend.addEvents([event, event, event]);
  const original = await read('local:col:events');
  const ids = original.slice(0, 2).map((x: AgendaEvent) => x.id);
  (storage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Disque fictif plein'));
  await expect(backend.removeEvents(ids)).rejects.toThrow('Disque fictif plein');
  expect(await read('local:col:events')).toEqual(original);
  await backend.removeEvents(ids);
  expect(await read('local:col:events')).toEqual([original[2]]);
});

test('la suppression de 52 horaires fait une seule écriture et conserve un ajout concurrent', async () => {
  await backend.addEvents(Array.from({ length: 52 }, () => event));
  const ids = (await read('local:col:events')).map((x: AgendaEvent) => x.id);
  (storage.setItem as jest.Mock).mockClear();
  await Promise.all([backend.removeEvents([...ids, ids[0]]), backend.add('events', { ...event, title: 'À garder' })]);
  expect(storage.setItem).toHaveBeenCalledTimes(2);
  expect((await read('local:col:events')).map((x: AgendaEvent) => x.title)).toEqual(['À garder']);
});

test.each([Array.from({ length: 53 }, (_, i) => `${i}`), [''], ['a/b']].map((ids) => [ids]))('un lot invalide est refusé avant toute écriture : %j', async (ids) => {
  (storage.setItem as jest.Mock).mockClear();
  await expect(backend.removeEvents(ids)).rejects.toThrow();
  expect(storage.setItem).not.toHaveBeenCalled();
});

test('un lot vide ne déclenche aucune écriture', async () => {
  (storage.setItem as jest.Mock).mockClear();
  await backend.removeEvents([]);
  expect(storage.setItem).not.toHaveBeenCalled();
});

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

test('la suppression attend une écriture engagée et ne laisse aucune donnée locale réapparaître', async () => {
  await storage.setItem('preferences:theme', 'dark');
  const write = (storage.setItem as jest.Mock).getMockImplementation()!;
  let finish!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  (storage.setItem as jest.Mock).mockImplementationOnce((key, value) => new Promise<void>((resolve) => {
    finish = () => { void write(key, value).then(resolve); }; started();
  }));
  const first = backend.add('notes', note('En cours'));
  await entered;
  const second = backend.add('notes', note('En attente'));
  let deleted = false;
  const deletion = api.deleteMyAccount(backend).then(() => { deleted = true; });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const completedTooEarly = deleted;
  finish();
  await Promise.allSettled([first, second]);
  await deletion;
  expect(completedTooEarly).toBe(false);
  expect((await storage.getAllKeys()).filter((key) => key.startsWith('local:') || key === 'session')).toEqual([]);
  expect(await storage.getItem('preferences:theme')).toBe('dark');
});

test('une nouvelle écriture et une autre suppression sont refusées pendant le nettoyage', async () => {
  const remove = (storage.multiRemove as jest.Mock).getMockImplementation()!;
  let finish!: () => void; let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  (storage.multiRemove as jest.Mock).mockImplementationOnce((keys) => new Promise<void>((resolve) => {
    finish = () => { void remove(keys).then(resolve); }; started();
  }));
  const deletion = api.deleteMyAccount(backend);
  await entered;
  const results = await Promise.allSettled([
    backend.add('notes', note('Trop tard')), api.deleteMyAccount(backend),
    api.createLocalCouple({ name: 'Autre', color: '#123456' }, { name: 'Partenaire', color: '#abcdef' }),
  ]);
  finish(); await deletion;
  expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected', 'rejected']);
});

test('un ancien backend ne peut pas écrire ni effacer un nouvel espace local', async () => {
  const old = backend;
  await api.deleteMyAccount(old);
  backend = await api.createLocalCouple({ name: 'Nouveau', color: '#123456' }, { name: 'Partenaire', color: '#abcdef' });
  await backend.add('notes', note('Nouvel espace'));
  const data = jest.fn(); const error = jest.fn();
  const stop = old.subscribe('notes', data, error);
  expect(data).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledTimes(1);
  stop();
  const results = await Promise.allSettled([old.add('notes', note('Ancien espace')), api.deleteMyAccount(old)]);
  expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Nouvel espace']);
});

test('une lecture terminée après suppression ne repeuple pas le cache ni les abonnés', async () => {
  let finish!: (raw: string | null) => void;
  (storage.getItem as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const data = jest.fn(); const error = jest.fn();
  const stop = backend.subscribe('notes', data, error);
  await api.deleteMyAccount(backend);
  backend = await api.createLocalCouple({ name: 'Nouveau', color: '#123456' }, { name: 'Partenaire', color: '#abcdef' });
  finish(JSON.stringify([{ ...note('Ancien texte'), id: 'old' }]));
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(data).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  await backend.add('notes', note('Nouveau texte'));
  expect((await read('local:col:notes')).map((x: { text: string }) => x.text)).toEqual(['Nouveau texte']);
  stop();
});

test('la suppression attend aussi une préparation de photo déjà engagée', async () => {
  const photos = jest.requireMock('../photos');
  let finish!: (uri: string) => void;
  photos.toCompactDataUri.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const photo = backend.uploadPhoto('fictitious://photo');
  let deleted = false;
  const deletion = api.deleteMyAccount(backend).then(() => { deleted = true; });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const completedTooEarly = deleted;
  finish('fictitious://saved');
  await photo; await deletion;
  expect(completedTooEarly).toBe(false);
  await expect(backend.add('memories', { photoUrl: 'fictitious://saved', date: '2026-10-15', createdBy: 'me', createdAt: 1 })).rejects.toThrow();
});

test('un échec du nettoyage reste visible, libère le verrou et permet une reprise', async () => {
  await backend.add('notes', note('À supprimer'));
  (storage.multiRemove as jest.Mock).mockRejectedValueOnce(new Error('Nettoyage fictif refusé'));
  await expect(api.deleteMyAccount(backend)).rejects.toThrow('Nettoyage fictif refusé');
  await backend.add('notes', note('Encore présent'));
  expect(await read('local:col:notes')).toHaveLength(2);
  await expect(api.deleteMyAccount(backend)).resolves.toBe('complete');
  expect(await storage.getItem('local:col:notes')).toBeNull();
});

test('une création locale engagée ne remémorise pas la session après le nettoyage', async () => {
  const write = (storage.setItem as jest.Mock).getMockImplementation()!;
  let finish!: () => void; let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  (storage.setItem as jest.Mock).mockImplementationOnce(write).mockImplementationOnce((key, value) => new Promise<void>((resolve) => {
    finish = () => { void write(key, value).then(resolve); }; started();
  }));
  const creation = api.createLocalCouple({ name: 'En cours', color: '#123456' }, { name: 'Partenaire', color: '#abcdef' });
  await entered;
  const deletion = api.deleteMyAccount(backend);
  finish();
  const created = await creation;
  await deletion;
  expect(await storage.getItem('session')).toBeNull();
  expect(await storage.getItem('local:couple')).toBeNull();
  await expect(created.add('notes', note('Tardif'))).rejects.toThrow();
});

test('une préparation de photo refusée ne bloque pas définitivement le nettoyage', async () => {
  let reject!: (error: Error) => void;
  jest.requireMock('../photos').toCompactDataUri.mockReturnValue(new Promise((_resolve, no) => { reject = no; }));
  const photo = backend.uploadPhoto('fictitious://photo');
  const result = Promise.allSettled([photo]);
  const deletion = api.deleteMyAccount(backend);
  reject(new Error('Photo fictive illisible'));
  expect((await result)[0].status).toBe('rejected');
  await expect(deletion).resolves.toBe('complete');
});
