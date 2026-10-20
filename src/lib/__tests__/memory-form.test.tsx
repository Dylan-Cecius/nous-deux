import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';
import Souvenirs from '@/app/souvenirs';
import { useCollectionState, useSession } from '../couple-context';
import { confirmDelete } from '@/components/ui';
import { showDialog } from '@/components/dialog';

jest.mock('../couple-context', () => ({ useCollectionState: jest.fn(), useSession: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/components/home/memories-strip', () => ({ useAddMemory: () => ({ add: jest.fn(), busy: false }) }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: 'image' }));
jest.mock('@/components/pickers', () => ({ DateField: 'date' }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { Pressable: { value: 'pressable' } }));
jest.mock('@/components/ui', () => ({ confirmDelete: jest.fn(), ...Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'Empty', 'Fab', 'Field', 'Sheet'].map((name) => [name, name.toLowerCase()])) }));

let root: ReactTestRenderer;
const memory = { id: 'one', caption: 'Souvenir fictif', date: '2020-01-02', photoUrl: 'fictitious://photo', createdBy: 'alice', createdAt: 1 };
const ready = { items: [memory], loading: false, error: false, retry: jest.fn() };
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', remove: jest.fn(), update: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  backend.remove.mockReset().mockResolvedValue(undefined);
  backend.update.mockReset().mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue({ backend });
  (useCollectionState as jest.Mock).mockReturnValue(ready);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const button = (label: string) => root.root.findByProps({ label }).props.onPress;
const sheet = () => root.root.findByType('sheet' as never);
const open = async () => {
  await act(async () => { root = create(<Souvenirs />); });
  await act(async () => root.root.findAllByType(Pressable)[0].props.onPress());
};
const refresh = async () => { await act(async () => root.update(<Souvenirs />)); };
const changeCaption = async (value: string) => { await act(async () => root.root.findByProps({ label: 'Légende' }).props.onChangeText(value)); };
const ask = async () => {
  await act(async () => button('Supprimer')());
  return (confirmDelete as jest.Mock).mock.calls.at(-1)[1];
};

test.each(['closed', 'reopened', 'backend', 'member', 'loading', 'error', 'removed'])('confirmation de souvenir ignorée après %s', async (kind) => {
  await open();
  const confirm = await ask();
  if (kind === 'closed' || kind === 'reopened') {
    await act(async () => sheet().props.onClose());
    if (kind === 'reopened') await act(async () => root.root.findAllByType(Pressable)[0].props.onPress());
  } else {
    if (kind === 'backend' || kind === 'member') (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, userId: kind === 'member' ? 'bob' : 'alice' } });
    else (useCollectionState as jest.Mock).mockReturnValue({ ...ready, ...(kind === 'removed' ? { items: [] } : { [kind]: true }) });
    await refresh();
  }
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
  if (kind === 'reopened') expect(sheet()).toBeTruthy();
});

test.each(['loading', 'error', 'removed'])('sauvegarde refusée après %s sans perdre la légende', async (kind) => {
  await open();
  await act(async () => root.root.findByProps({ label: 'Légende' }).props.onChangeText('Brouillon fictif'));
  const save = button('Enregistrer');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, ...(kind === 'removed' ? { items: [] } : { [kind]: true }) });
  await refresh();
  await act(async () => { await save(); });
  expect(backend.update).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe('Brouillon fictif');
});

test('sauvegarde, suppression, saisie et fermeture partagent le verrou immédiat', async () => {
  await open();
  await act(async () => root.root.findByProps({ label: 'Légende' }).props.onChangeText('Brouillon à enregistrer'));
  const confirm = await ask();
  const changeCaption = root.root.findByProps({ label: 'Légende' }).props.onChangeText;
  const changeDate = root.root.findByType('date' as never).props.onChange;
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  const save = button('Enregistrer');
  await act(async () => { pending = save(); await save(); await confirm(); await changeCaption('Trop tard'); await changeDate('2021-02-03'); sheet().props.onClose(); });
  expect(backend.update).toHaveBeenCalledTimes(1);
  expect(backend.remove).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Légende' }).props).toMatchObject({ value: 'Brouillon à enregistrer', editable: false });
  expect(root.root.findByType('date' as never).props).toMatchObject({ value: memory.date, disabled: true });
  await act(async () => { finish(); await pending; });
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});

test('un échec conserve le brouillon et permet une nouvelle tentative', async () => {
  await open();
  await changeCaption('Brouillon à enregistrer');
  backend.update.mockRejectedValueOnce(new Error('Échec fictif'));
  await act(async () => { await button('Enregistrer')(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Échec fictif');
  expect(root.root.findByProps({ label: 'Légende' }).props.editable).toBe(true);
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenCalledTimes(2);
});

test.each(['success', 'error'])('un retour %s d’un ancien backend ne ferme pas la fiche courante', async (outcome) => {
  await open();
  await changeCaption('Brouillon à enregistrer');
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve, reject) => { finish = () => outcome === 'success' ? resolve() : reject(new Error('Ancien échec')); }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer')(); });
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend } });
  await refresh();
  await act(async () => { finish(); await pending; });
  expect(sheet()).toBeTruthy();
  expect(showDialog).not.toHaveBeenCalled();
});

test('chaque souvenir possède son propre brouillon', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [memory, { ...memory, id: 'two', caption: 'Autre souvenir', createdAt: 0 }] });
  await open();
  await act(async () => root.root.findAllByType(Pressable)[1].props.onPress());
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe('Autre souvenir');
});

test('une date future est refusée dans l’action et un album en erreur peut être relancé', async () => {
  await open();
  await act(async () => root.root.findByType('date' as never).props.onChange('2999-01-01'));
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).not.toHaveBeenCalled();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await refresh();
  await act(async () => button('Recharger l’album du formulaire')());
  expect(ready.retry).toHaveBeenCalledTimes(1);
});

test('suppression confirmée : un seul appel pour un double appui', async () => {
  await open();
  const confirm = await ask();
  await act(async () => { await Promise.all([confirm(), confirm()]); });
  expect(backend.remove).toHaveBeenCalledTimes(1);
  expect(backend.remove).toHaveBeenCalledWith('memories', memory.id);
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});

test('un échec de suppression garde la fiche et permet de confirmer à nouveau', async () => {
  await open();
  backend.remove.mockRejectedValueOnce(new Error('Échec fictif'));
  const confirm = await ask();
  await act(async () => { await confirm(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Échec fictif');
  expect(sheet()).toBeTruthy();
  const retry = await ask();
  await act(async () => { await retry(); });
  expect(backend.remove).toHaveBeenCalledTimes(2);
});

test('une date reçue du partenaire actualise le champ intact sans remplacer la légende saisie', async () => {
  await open();
  await changeCaption('Mon brouillon');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...memory, date: '2022-03-04', caption: 'Légende du partenaire' }] });
  await refresh();
  expect(root.root.findByType('date' as never).props.value).toBe('2022-03-04');
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe('Mon brouillon');
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenCalledWith('memories', memory.id, { caption: 'Mon brouillon' });
});

test('modifier uniquement la date ne renvoie pas une légende périmée', async () => {
  await open();
  await act(async () => root.root.findByType('date' as never).props.onChange('2021-05-06'));
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...memory, caption: 'Légende du partenaire' }] });
  await refresh();
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe('Légende du partenaire');
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenCalledWith('memories', memory.id, { date: '2021-05-06' });
});

test('une fiche intacte se ferme sans écriture, même après actualisation distante', async () => {
  await open();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...memory, caption: 'Autre légende' }] });
  await refresh();
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).not.toHaveBeenCalled();
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});

test('un ancien bouton enregistre le brouillon courant et pas la saisie précédente', async () => {
  await open();
  const oldSave = button('Enregistrer');
  await changeCaption('Brouillon courant');
  await act(async () => { await oldSave(); });
  expect(backend.update).toHaveBeenCalledWith('memories', memory.id, { caption: 'Brouillon courant' });
});

test.each(['caption', 'date', 'both'])('une saisie %s suivie de validation avant rendu envoie la dernière valeur', async kind => {
  await open();
  const change = root.root.findByProps({ label: 'Légende' }).props.onChangeText;
  const date = root.root.findByType('date' as never).props.onChange;
  const save = button('Enregistrer');
  await act(async () => {
    if (kind !== 'date') await change('  Dernière légende  ');
    if (kind !== 'caption') await date('2021-02-03');
    await save();
  });
  expect(backend.update).toHaveBeenCalledWith('memories', memory.id, {
    ...(kind !== 'date' ? { caption: 'Dernière légende' } : {}),
    ...(kind !== 'caption' ? { date: '2021-02-03' } : {}),
  });
});

test('une date devenue future avant rendu ne déclenche pas de sauvegarde ni fermeture', async () => {
  await open();
  await changeCaption('Brouillon à préserver');
  const change = root.root.findByType('date' as never).props.onChange;
  const save = button('Enregistrer');
  await act(async () => { await change('2999-01-01'); await save(); });
  expect(backend.update).not.toHaveBeenCalled();
  expect(sheet()).toBeTruthy();
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe('Brouillon à préserver');
});

test('le dernier contenu reçu reste affiché lors d’une erreur de lecture', async () => {
  await open();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...memory, caption: 'Actualisé', date: '2022-02-02' }] });
  await refresh();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [], error: true });
  await refresh();
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe('Actualisé');
  expect(root.root.findByType('date' as never).props.value).toBe('2022-02-02');
});

test.each([false, true])('la fiche utilise la photo courante de la collection (après reprise : %s)', async retry => {
  await open();
  await changeCaption('Mon brouillon intact');
  if (retry) {
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
    await refresh();
    expect(sheet().findAllByType('image' as never)).toHaveLength(0);
  }
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...memory, photoUrl: 'fictitious://current-photo' }] });
  await refresh();
  expect(sheet().findByType('image' as never).props.source.uri).toBe('fictitious://current-photo');
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe('Mon brouillon intact');
  await act(async () => button('Enregistrer')());
  expect(backend.update).toHaveBeenCalledWith('memories', memory.id, { caption: 'Mon brouillon intact' });
});

test('les espaces de saisie sont conservés à l’écran sans déclencher une écriture identique', async () => {
  await open();
  await changeCaption(`${memory.caption} `);
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe(`${memory.caption} `);
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).not.toHaveBeenCalled();
});

test('les deux champs saisis survivent à une actualisation puis sont seuls envoyés', async () => {
  await open();
  await changeCaption('  Mon brouillon  ');
  await act(async () => root.root.findByType('date' as never).props.onChange('2021-01-01'));
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...memory, caption: 'Autre légende', date: '2023-01-01' }] });
  await refresh();
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe('  Mon brouillon  ');
  expect(root.root.findByType('date' as never).props.value).toBe('2021-01-01');
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenCalledWith('memories', memory.id, { caption: 'Mon brouillon', date: '2021-01-01' });
});

test('une valeur déjà confirmée par la lecture n’est pas renvoyée après échec ambigu', async () => {
  await open();
  await changeCaption('Mon brouillon');
  backend.update.mockRejectedValueOnce(new Error('Confirmation perdue'));
  await act(async () => { await button('Enregistrer')(); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...memory, caption: 'Mon brouillon' }] });
  await refresh();
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenCalledTimes(1);
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});
