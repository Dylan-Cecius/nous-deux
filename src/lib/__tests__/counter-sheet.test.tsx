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

test('une date intacte suit celle reçue du partenaire sans la réécrire', async () => {
  const save = button('Enregistrer la date');
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, since: '2022-04-05' } });
  await refresh();
  expect(root.root.findByType('date' as never).props.value).toBe('2022-04-05');
  await act(async () => save());
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('valider une date inchangée ferme la fiche sans écriture', async () => {
  await act(async () => button('Enregistrer la date')());
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('une date saisie survit aux changements du partenaire et reste le seul champ envoyé', async () => {
  await act(async () => root.root.findByType('date' as never).props.onChange('2021-02-03'));
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, since: '2022-04-05', photoUrl: 'fictitious://new-photo' } });
  await refresh();
  expect(root.root.findByType('date' as never).props.value).toBe('2021-02-03');
  await act(async () => button('Enregistrer la date')());
  expect(backend.updateCouple).toHaveBeenCalledWith({ since: '2021-02-03' });
});

test.each([true, false])('la reprise de lecture actualise seulement une date intacte (%s)', async (dirty) => {
  if (dirty) await act(async () => root.root.findByType('date' as never).props.onChange('2021-02-03'));
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: null });
  await refresh();
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, since: '2022-04-05' } });
  await refresh();
  expect(root.root.findByType('date' as never).props.value).toBe(dirty ? '2021-02-03' : '2022-04-05');
});

test('une date jamais définie peut être enregistrée', async () => {
  await act(async () => root.unmount());
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, since: undefined } });
  await act(async () => { root = create(<CounterSheet onClose={onClose} />); });
  const value = root.root.findByType('date' as never).props.value;
  await act(async () => button('Enregistrer la date')());
  expect(backend.updateCouple).toHaveBeenCalledWith({ since: value });
});

test('la date reste figée pendant la sauvegarde et modifiable après échec', async () => {
  const date = () => root.root.findByType('date' as never);
  await act(async () => date().props.onChange('2020-02-03'));
  const change = date().props.onChange;
  let reject!: (error: Error) => void;
  backend.updateCouple.mockReturnValueOnce(new Promise<void>((_, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer la date')(); await change('2021-02-03'); });
  expect(date().props.value).toBe('2020-02-03');
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

test('un cadrage intact suit celui reçu du partenaire sans réécriture', async () => {
  await act(async () => button('Repositionner la photo')());
  const save = button('Enregistrer le cadrage');
  const photoFrame = { x: 0.3, y: 0.4, zoom: 1.5 };
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, photoFrame } });
  await refresh();
  expect(root.root.findByType('editor' as never).props.frame).toEqual(photoFrame);
  await act(async () => save());
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(root.root.findByType('sheet' as never).props.title).toBe('Votre histoire');
});

test('un cadrage inchangé se ferme sans écriture', async () => {
  await act(async () => button('Repositionner la photo')());
  await act(async () => button('Enregistrer le cadrage')());
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(root.root.findByType('sheet' as never).props.title).toBe('Votre histoire');
});

test('un cadrage modifié reste une transformation cohérente après modification distante', async () => {
  await act(async () => button('Repositionner la photo')());
  const photoFrame = { ...couple.photoFrame, x: 0.7 };
  await act(async () => root.root.findByType('editor' as never).props.onChange(photoFrame));
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, photoFrame: { ...couple.photoFrame, zoom: 1 } } });
  await refresh();
  expect(root.root.findByType('editor' as never).props.frame).toEqual(photoFrame);
  await act(async () => button('Enregistrer le cadrage')());
  expect(backend.updateCouple).toHaveBeenCalledWith({ photoFrame });
});

test.each([true, false])('le cadrage reçu après reprise préserve seulement une modification locale (%s)', async (dirty) => {
  await act(async () => button('Repositionner la photo')());
  const local = { x: 0.7, y: 0.2, zoom: 2 };
  if (dirty) await act(async () => root.root.findByType('editor' as never).props.onChange(local));
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: null });
  await refresh();
  const received = { x: 0.3, y: 0.4, zoom: 1.5 };
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, photoFrame: received } });
  await refresh();
  expect(root.root.findByType('editor' as never).props.frame).toEqual(dirty ? local : received);
});

test('le cadrage ne change pas pendant la sauvegarde puis reprend après échec', async () => {
  await act(async () => button('Repositionner la photo')());
  const editor = () => root.root.findByType('editor' as never);
  const initialEdit = { ...couple.photoFrame, x: 0.2 };
  await act(async () => editor().props.onChange(initialEdit));
  const change = editor().props.onChange;
  const nextFrame = { x: 0.7, y: 0.8, zoom: 1.5 };
  let reject!: (error: Error) => void;
  backend.updateCouple.mockReturnValueOnce(new Promise<void>((_, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer le cadrage')(); await change(nextFrame); });
  expect(editor().props.frame).toEqual(initialEdit);
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

test.each(['selection', 'upload', 'save'])('un résultat %s ne reprend pas après perte puis retour de la fiche', async stage => {
  let finish!: (value: unknown) => void;
  const operation = new Promise(resolve => { finish = resolve; });
  if (stage === 'selection') (pickPhoto as jest.Mock).mockReturnValueOnce(operation);
  else if (stage === 'upload') backend.uploadPhoto.mockReturnValueOnce(operation);
  else backend.updateCouple.mockReturnValueOnce(operation);
  let pending!: Promise<void>;
  await act(async () => { pending = button('Changer la photo de couple')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: null });
  await refresh();
  (useSession as jest.Mock).mockReturnValue(session);
  await refresh();
  // Le verrou reste acquis tant que l’ancienne opération n’a pas fini.
  expect(root.root.findByProps({ label: 'Changer la photo de couple' }).props.disabled).toBe(true);
  await act(async () => { finish(stage === 'selection' ? { uri: 'fictitious://old' } : 'fictitious://old-upload'); await pending; });
  expect(backend.uploadPhoto).toHaveBeenCalledTimes(stage === 'selection' ? 0 : 1);
  expect(backend.updateCouple).toHaveBeenCalledTimes(stage === 'save' ? 1 : 0);
  expect(root.root.findByType('sheet' as never).props.title).toBe('Votre histoire');
  expect(showDialog).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Changer la photo de couple' }).props.disabled).toBe(false);
});

test.each(['selection', 'upload', 'date', 'frame'])('un échec %s avant une coupure ne notifie pas la fiche reprise', async stage => {
  let reject!: (error: Error) => void;
  const operation = new Promise((_, fail) => { reject = fail; });
  if (stage === 'selection') (pickPhoto as jest.Mock).mockReturnValueOnce(operation);
  else if (stage === 'upload') backend.uploadPhoto.mockReturnValueOnce(operation);
  else backend.updateCouple.mockReturnValueOnce(operation);
  if (stage === 'date') await act(async () => root.root.findByType('date' as never).props.onChange('2021-02-03'));
  if (stage === 'frame') {
    await act(async () => button('Repositionner la photo')());
    await act(async () => root.root.findByType('editor' as never).props.onChange({ ...couple.photoFrame, x: 0.3 }));
  }
  let pending!: Promise<void>;
  await act(async () => { pending = button(stage === 'date' ? 'Enregistrer la date' : stage === 'frame' ? 'Enregistrer le cadrage' : 'Changer la photo de couple')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: null });
  await refresh();
  (useSession as jest.Mock).mockReturnValue(session);
  await refresh();
  await act(async () => { reject(new Error('ancienne opération fictive')); await pending; });
  expect(showDialog).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

test('une sauvegarde de date engagée ne ferme pas la fiche après reprise de lecture', async () => {
  let finish!: () => void;
  backend.updateCouple.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  await act(async () => root.root.findByType('date' as never).props.onChange('2021-02-03'));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer la date')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: null });
  await refresh();
  (useSession as jest.Mock).mockReturnValue(session);
  await refresh();
  await act(async () => { finish(); await pending; });
  expect(backend.updateCouple).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  expect(root.root.findByType('date' as never).props.value).toBe('2021-02-03');
});

test.each(['selection', 'upload'].flatMap(stage => [false, true].flatMap(empty => [false, true].map(restored => ({ stage, empty, restored })))))('une photo reçue pendant $stage bloque le remplacement (vide=$empty, retour=$restored)', async ({ stage, empty, restored }) => {
  const initial = { ...couple, photoUrl: empty ? undefined : couple.photoUrl };
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: initial });
  await refresh();
  let finish!: (value: unknown) => void;
  const operation = new Promise(resolve => { finish = resolve; });
  if (stage === 'selection') (pickPhoto as jest.Mock).mockReturnValueOnce(operation);
  else backend.uploadPhoto.mockReturnValueOnce(operation);
  let pending!: Promise<void>;
  await act(async () => { pending = button(empty ? 'Ajouter une photo de couple' : 'Changer la photo de couple')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...initial, photoUrl: 'fictitious://partner' } });
  await refresh();
  if (restored) {
    (useSession as jest.Mock).mockReturnValue({ ...session, couple: initial });
    await refresh();
  }
  await act(async () => { finish(stage === 'selection' ? { uri: 'fictitious://picked' } : 'fictitious://uploaded'); await pending; });
  expect(backend.uploadPhoto).toHaveBeenCalledTimes(stage === 'selection' ? 0 : 1);
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(root.root.findByType('sheet' as never).props.title).toBe('Votre histoire');
  expect(showDialog).toHaveBeenCalledWith('Photo de couple actualisée', expect.stringContaining('Relance'));
  expect(root.root.findByProps({ label: 'Enregistrer la date' }).props.disabled).toBe(false);
  await act(async () => button(empty && restored ? 'Ajouter une photo de couple' : 'Changer la photo de couple')());
  expect(backend.updateCouple).toHaveBeenCalledTimes(1);
  expect(root.root.findByType('sheet' as never).props.title).toBe('Cadrer la photo');
});

test('une date reçue pendant la sélection ne bloque pas le remplacement de photo', async () => {
  let finish!: (value: unknown) => void;
  (pickPhoto as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Changer la photo de couple')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, since: '2023-01-01' } });
  await refresh();
  await act(async () => { finish({ uri: 'fictitious://picked' }); await pending; });
  expect(backend.updateCouple).toHaveBeenCalledWith({ photoUrl: 'fictitious://uploaded', photoFrame: { x: 0.5, y: 0.5, zoom: 1 } });
  expect(showDialog).not.toHaveBeenCalled();
});

test('la notification de sa propre photo pendant la sauvegarde autorise le cadrage', async () => {
  let finish!: () => void;
  backend.updateCouple.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Changer la photo de couple')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { ...couple, photoUrl: 'fictitious://uploaded' } });
  await refresh();
  await act(async () => { finish(); await pending; });
  expect(root.root.findByType('editor' as never).props.uri).toBe('fictitious://uploaded');
  expect(root.root.findByType('editor' as never).props.disabled).toBe(false);
  expect(showDialog).not.toHaveBeenCalled();
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
  await act(async () => root.root.findByType('date' as never).props.onChange('2021-02-03'));
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
  await act(async () => root.root.findByType('date' as never).props.onChange('2021-02-03'));
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
  expect(backend.updateCouple).toHaveBeenCalledWith({ since: '2021-02-03' });
});

test('fermer invalide immédiatement un ancien gestionnaire', async () => {
  const photo = button('Changer la photo de couple');
  await act(async () => { root.root.findByType('sheet' as never).props.onClose(); await photo(); });
  expect(pickPhoto).not.toHaveBeenCalled();
});

test.each(['selection', 'upload', 'association', 'date', 'frame'])('une erreur %s ne révèle pas de détails privés et ne promet pas un échec certain', async (stage) => {
  const error = new Error('fictitious://private-photo?token=private-token');
  if (stage === 'selection') (pickPhoto as jest.Mock).mockRejectedValueOnce(error);
  else if (stage === 'upload') backend.uploadPhoto.mockRejectedValueOnce(error);
  else backend.updateCouple.mockRejectedValueOnce(error);
  if (stage === 'date') await act(async () => root.root.findByType('date' as never).props.onChange('2021-02-03'));
  if (stage === 'frame') {
    await act(async () => button('Repositionner la photo')());
    await act(async () => root.root.findByType('editor' as never).props.onChange({ ...couple.photoFrame, x: 0.3 }));
  }
  await act(async () => button(stage === 'date' ? 'Enregistrer la date' : stage === 'frame' ? 'Enregistrer le cadrage' : 'Changer la photo de couple')());
  expect(showDialog).toHaveBeenCalledTimes(1);
  expect(JSON.stringify((showDialog as jest.Mock).mock.calls)).not.toContain('private-token');
  expect(onClose).not.toHaveBeenCalled();
  if (['date', 'frame', 'association'].includes(stage)) {
    expect(showDialog).toHaveBeenCalledWith('Enregistrement non confirmé', expect.stringContaining('Vérifie'));
  }
});

test('une erreur photo non standard n’est pas inspectée et libère le verrou', async () => {
  const error = Object.defineProperty({}, 'message', { get() { throw new Error('Ne pas inspecter'); } });
  backend.uploadPhoto.mockRejectedValueOnce(error);
  await act(async () => button('Changer la photo de couple')());
  expect(showDialog).toHaveBeenCalledTimes(1);
  expect(root.root.findByProps({ label: 'Changer la photo de couple' }).props.disabled).toBe(false);
});

test('un échec du sélecteur est affiché et autorise une nouvelle tentative', async () => {
  (pickPhoto as jest.Mock).mockRejectedValueOnce(new Error('Galerie fictivement indisponible'));
  await act(async () => { await button('Changer la photo de couple')(); });
  expect(showDialog).toHaveBeenCalledWith('Photo non enregistrée', 'Impossible de préparer cette photo. Vérifie son accès ou choisis une autre image.');
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
  expect(showDialog).toHaveBeenCalledWith('Photo non enregistrée', 'Impossible de préparer la photo de couple. Vérifie son accès et ta connexion avant de réessayer.');
  expect(backend.updateCouple).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => { await button('Changer la photo de couple')(); });
  expect(backend.updateCouple).toHaveBeenCalledTimes(1);
});
