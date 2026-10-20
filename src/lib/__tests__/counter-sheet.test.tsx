import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CounterSheet } from '@/components/home/counter-card';
import { useSession } from '../couple-context';
import { pickPhoto } from '../photos';
import { showDialog } from '@/components/dialog';

jest.mock('../couple-context', () => ({ useSession: jest.fn() }));
jest.mock('../photos', () => ({ pickPhoto: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/components/framed-photo', () => ({ DEFAULT_FRAME: { x: 0.5, y: 0.5, zoom: 1 }, PhotoFrameEditor: (props: object) => jest.requireActual('react').createElement('editor', props) }));
jest.mock('@/components/pickers', () => ({ DateField: (props: object) => jest.requireActual('react').createElement('date', props) }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Button', 'Sheet', 'T'].map((name) => [name, (props: object) => React.createElement(name.toLowerCase(), props)]));
});
let root: ReactTestRenderer;
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', uploadPhoto: jest.fn(), updateCouple: jest.fn() };
const couple = { since: '2020-01-02', photoUrl: 'fictitious://original', photoFrame: { x: 0.1, y: 0.2, zoom: 2 } };
const session = { backend, couple };
const onClose = jest.fn();
const button = (label: string) => root.root.findByProps({ label }).props.onPress;
const refresh = async () => { await act(async () => root.update(<CounterSheet onClose={onClose} />)); };
beforeEach(async () => {
  jest.resetAllMocks();
  (useSession as jest.Mock).mockReturnValue(session);
  (pickPhoto as jest.Mock).mockResolvedValue({ uri: 'fictitious://picked' });
  backend.uploadPhoto.mockResolvedValue('fictitious://uploaded');
  backend.updateCouple.mockResolvedValue(undefined);
  await act(async () => { root = create(<CounterSheet onClose={onClose} />); });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const leave = async (kind: string) => {
  if (kind === 'unmount') await act(async () => root.unmount());
  else {
    (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: 'bob' } });
    await refresh();
  }
};

test('un ancien bouton enregistre la date courante plutôt que celle de son rendu', async () => {
  const save = button('Enregistrer la date');
  await act(async () => root.root.findByType('date' as never).props.onChange('2021-02-03'));
  await act(async () => save());
  expect(backend.updateCouple).toHaveBeenCalledWith({ since: '2021-02-03' });
});

test('un ancien bouton refuse une date devenue future', async () => {
  const save = button('Enregistrer la date');
  await act(async () => root.root.findByType('date' as never).props.onChange('2999-01-01'));
  await act(async () => save());
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

test('une saisie suivie de sauvegarde sans nouveau rendu utilise la nouvelle date', async () => {
  const save = button('Enregistrer la date');
  const change = root.root.findByType('date' as never).props.onChange;
  await act(async () => { await change('2021-02-03'); await save(); });
  expect(backend.updateCouple).toHaveBeenCalledWith({ since: '2021-02-03' });
});

test.each(['date', 'photo'])('une ancienne action %s ne s’exécute pas depuis le cadrage', async (kind) => {
  const action = button(kind === 'date' ? 'Enregistrer la date' : 'Changer la photo de couple');
  await act(async () => button('Repositionner la photo')());
  await act(async () => action());
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(pickPhoto).not.toHaveBeenCalled();
});

test.each([true, false])('un ancien bouton lit le cadrage courant (rendu intermédiaire : %s)', async (rerender) => {
  await act(async () => button('Repositionner la photo')());
  const save = button('Enregistrer le cadrage');
  const change = root.root.findByType('editor' as never).props.onChange;
  const photoFrame = { x: 0.7, y: 0.8, zoom: 1.5 };
  if (rerender) {
    await act(async () => change(photoFrame));
    await act(async () => save());
  } else await act(async () => { await change(photoFrame); await save(); });
  expect(backend.updateCouple).toHaveBeenCalledWith({ photoFrame });
});

test('l’ouverture du cadrage invalide immédiatement les anciennes actions du formulaire', async () => {
  const save = button('Enregistrer la date');
  const photo = button('Changer la photo de couple');
  const close = root.root.findByType('sheet' as never).props.onClose;
  const frame = button('Repositionner la photo');
  await act(async () => { await frame(); await save(); await photo(); await close(); });
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(pickPhoto).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(root.root.findByType('sheet' as never).props.title).toBe('Cadrer la photo');
});

test('fermer le cadrage invalide sa sauvegarde avant le rendu', async () => {
  await act(async () => button('Repositionner la photo')());
  const save = button('Enregistrer le cadrage');
  const close = root.root.findByType('sheet' as never).props.onClose;
  await act(async () => { await close(); await save(); });
  expect(backend.updateCouple).not.toHaveBeenCalled();
});

test('une ancienne fermeture de cadrage ne ferme pas un nouveau cadrage', async () => {
  await act(async () => button('Repositionner la photo')());
  const close = root.root.findByType('sheet' as never).props.onClose;
  await act(async () => close());
  await act(async () => button('Repositionner la photo')());
  await act(async () => close());
  expect(root.root.findByType('sheet' as never).props.title).toBe('Cadrer la photo');
});

test('la date reste figée pendant la sauvegarde et modifiable après échec', async () => {
  const date = () => root.root.findByType('date' as never);
  const change = date().props.onChange;
  let reject!: (error: Error) => void;
  backend.updateCouple.mockReturnValueOnce(new Promise<void>((_, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer la date')(); await change('2021-02-03'); });
  expect(date().props.value).toBe(couple.since);
  expect(date().props.disabled).toBe(true);
  await act(async () => { reject(new Error('Échec fictif')); await pending; });
  expect(date().props.disabled).toBe(false);
  await act(async () => date().props.onChange('2021-02-03'));
  await act(async () => { await button('Enregistrer la date')(); });
  expect(backend.updateCouple).toHaveBeenLastCalledWith({ since: '2021-02-03' });
});

test.each(['closed', 'framing', 'backend', 'unavailable'])('une ancienne saisie de date est ignorée après %s', async (kind) => {
  const change = root.root.findByType('date' as never).props.onChange;
  if (kind === 'closed') await act(async () => root.root.findByType('sheet' as never).props.onClose());
  else if (kind === 'framing') await act(async () => button('Repositionner la photo')());
  else {
    (useSession as jest.Mock).mockReturnValue({ ...session, ...(kind === 'backend' ? { backend: { ...backend } } : { couple: null }) });
    await refresh();
  }
  await act(async () => change('2021-02-03'));
  if (kind === 'framing') await act(async () => root.root.findByType('sheet' as never).props.onClose());
  expect(root.root.findByType('date' as never).props.value).toBe(couple.since);
});

test('le cadrage ne change pas pendant la sauvegarde puis reprend après échec', async () => {
  await act(async () => button('Repositionner la photo')());
  const editor = () => root.root.findByType('editor' as never);
  const change = editor().props.onChange;
  const nextFrame = { x: 0.7, y: 0.8, zoom: 1.5 };
  let reject!: (error: Error) => void;
  backend.updateCouple.mockReturnValueOnce(new Promise<void>((_, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer le cadrage')(); await change(nextFrame); });
  expect(editor().props.frame).toEqual(couple.photoFrame);
  expect(editor().props.disabled).toBe(true);
  await act(async () => { reject(new Error('Échec fictif')); await pending; });
  expect(editor().props.disabled).toBe(false);
  await act(async () => editor().props.onChange(nextFrame));
  await act(async () => { await button('Enregistrer le cadrage')(); });
  expect(backend.updateCouple).toHaveBeenLastCalledWith({ photoFrame: nextFrame });
});

test('un ancien éditeur ne modifie pas un cadrage rouvert', async () => {
  await act(async () => button('Repositionner la photo')());
  const change = root.root.findByType('editor' as never).props.onChange;
  await act(async () => root.root.findByType('sheet' as never).props.onClose());
  await act(async () => button('Repositionner la photo')());
  await act(async () => change({ x: 0.7, y: 0.8, zoom: 1.5 }));
  expect(root.root.findByType('editor' as never).props.frame).toEqual(couple.photoFrame);
});

test.each(['unmount', 'backend'])('sélecteur tardif après %s : aucun upload', async (kind) => {
  let finish!: (result: unknown) => void;
  (pickPhoto as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Changer la photo de couple')(); });
  await leave(kind);
  await act(async () => { finish({ uri: 'fictitious://picked' }); await pending; });
  expect(backend.uploadPhoto).not.toHaveBeenCalled();
  expect(backend.updateCouple).not.toHaveBeenCalled();
});

test.each(['unmount', 'backend'])('upload tardif après %s : aucune association', async (kind) => {
  let finish!: (url: string) => void;
  backend.uploadPhoto.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Changer la photo de couple')(); });
  await leave(kind);
  await act(async () => { finish('fictitious://uploaded'); await pending; });
  expect(backend.updateCouple).not.toHaveBeenCalled();
});

test.each(['success', 'error'])('réponse %s d’une ancienne sauvegarde ne ferme pas le nouveau formulaire', async (outcome) => {
  let finish!: () => void;
  backend.updateCouple.mockReturnValueOnce(new Promise<void>((resolve, reject) => { finish = () => outcome === 'success' ? resolve() : reject(new Error('Ancien échec')); }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer la date')(); });
  await leave('backend');
  await act(async () => { finish(); await pending; });
  expect(onClose).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});

test('sélection, date et fermeture partagent un verrou immédiat', async () => {
  let finish!: (result: unknown) => void;
  (pickPhoto as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const photo = button('Changer la photo de couple');
  const saveDate = button('Enregistrer la date');
  let pending!: Promise<void>;
  await act(async () => {
    pending = photo(); await photo(); await saveDate();
    root.root.findByType('sheet' as never).props.onClose();
  });
  expect(pickPhoto).toHaveBeenCalledTimes(1);
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => { finish(null); await pending; });
  await act(async () => { await button('Enregistrer la date')(); });
  expect(backend.updateCouple).toHaveBeenCalledWith({ since: '2020-01-02' });
});

test('fermer invalide immédiatement un ancien gestionnaire', async () => {
  const photo = button('Changer la photo de couple');
  await act(async () => { root.root.findByType('sheet' as never).props.onClose(); await photo(); });
  expect(pickPhoto).not.toHaveBeenCalled();
});

test('un échec du sélecteur est affiché et autorise une nouvelle tentative', async () => {
  (pickPhoto as jest.Mock).mockRejectedValueOnce(new Error('Galerie fictivement indisponible'));
  await act(async () => { await button('Changer la photo de couple')(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Galerie fictivement indisponible');
  await act(async () => { await button('Changer la photo de couple')(); });
  expect(backend.updateCouple).toHaveBeenCalledTimes(1);
});

test('la photo reçue après upload est celle du cadrage, même avant la notification de collection', async () => {
  await act(async () => { await button('Changer la photo de couple')(); });
  expect(root.root.findByType('editor' as never).props.uri).toBe('fictitious://uploaded');
});

test('un cadrage ancien n’est pas appliqué à une photo remplacée', async () => {
  await act(async () => button('Repositionner la photo')());
  const save = button('Enregistrer le cadrage');
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, photoUrl: 'fictitious://replacement' } });
  await refresh();
  await act(async () => { await save(); });
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(JSON.stringify(root.toJSON())).toContain('La photo a changé');
});

test.each(['date', 'photo', 'frame'])('une fiche couple indisponible bloque %s', async (kind) => {
  if (kind === 'frame') await act(async () => button('Repositionner la photo')());
  const action = button(kind === 'date' ? 'Enregistrer la date' : kind === 'frame' ? 'Enregistrer le cadrage' : 'Changer la photo de couple');
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: null });
  await refresh();
  await act(async () => { await action(); });
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(pickPhoto).not.toHaveBeenCalled();
});

test('une date future reste refusée par l’action', async () => {
  await act(async () => root.root.findByType('date' as never).props.onChange('2999-01-01'));
  await act(async () => { await button('Enregistrer la date')(); });
  expect(backend.updateCouple).not.toHaveBeenCalled();
});

test('la photo synchronisée peut recevoir son nouveau cadrage', async () => {
  await act(async () => { await button('Changer la photo de couple')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, photoUrl: 'fictitious://uploaded' } });
  await refresh();
  const frame = { x: 0.3, y: 0.4, zoom: 1.5 };
  await act(async () => root.root.findByType('editor' as never).props.onChange(frame));
  await act(async () => { await button('Enregistrer le cadrage')(); });
  expect(backend.updateCouple).toHaveBeenLastCalledWith({ photoFrame: frame });
  expect(root.root.findByType('sheet' as never).props.title).toBe('Votre histoire');
});

test('revenir au cadrage ne réactive pas un ancien bouton de sauvegarde', async () => {
  await act(async () => button('Repositionner la photo')());
  const oldSave = button('Enregistrer le cadrage');
  await act(async () => root.root.findByType('sheet' as never).props.onClose());
  await act(async () => button('Repositionner la photo')());
  await act(async () => { await oldSave(); });
  expect(backend.updateCouple).not.toHaveBeenCalled();
});

test('une erreur de photo courante libère le verrou sans quitter le formulaire', async () => {
  backend.uploadPhoto.mockRejectedValueOnce(new Error('Upload fictivement refusé'));
  await act(async () => { await button('Changer la photo de couple')(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Upload fictivement refusé');
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => { await button('Changer la photo de couple')(); });
  expect(backend.updateCouple).toHaveBeenCalledTimes(1);
});
