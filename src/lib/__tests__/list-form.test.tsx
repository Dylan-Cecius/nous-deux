import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Listes from '@/app/(tabs)/listes';
import { useCollectionState, useSession } from '../couple-context';
import { confirmDelete } from '@/components/ui';
import { showDialog } from '@/components/dialog';

jest.mock('../couple-context', () => ({ useCollectionState: jest.fn(), useSession: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn(), tap: jest.fn() }));
jest.mock('@/components/celebrate', () => ({ celebrate: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), Fonts: {} }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return { confirmDelete: jest.fn(), ...Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'IconButton', 'Row', 'Dot', 'Empty', 'Fab', 'Ionicons', 'Field', 'Chips', 'Segmented', 'Sheet', 'ProgressBar'].map((name) => [name, (props: object) => React.createElement(name.toLowerCase(), props)])) };
});

let root: ReactTestRenderer;
const item = { id: 'one', list: 'bucket', title: 'Envie fictive', done: false, createdBy: 'alice', createdAt: 1 };
const ready = { items: [item], loading: false, error: false, retry: jest.fn() };
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', remove: jest.fn(), update: jest.fn(), add: jest.fn() };
const session = { backend, partner: null, colorOf: () => '#000' };
beforeEach(() => {
  jest.clearAllMocks();
  for (const fn of [backend.remove, backend.update, backend.add]) fn.mockReset().mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue(session);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const button = (label: string) => root.root.findByProps({ label }).props.onPress;
const sheet = () => root.root.findByType('sheet' as never);
const open = async (fresh = false) => {
  await act(async () => { root = create(<Listes />); });
  await act(async () => {
    if (fresh) button('Ajouter une envie')();
    else root.root.findAll((node) => typeof node.props.onLongPress === 'function')[0].props.onPress();
  });
};
const ask = async () => {
  await act(async () => button('Supprimer')());
  return (confirmDelete as jest.Mock).mock.calls.at(-1)[1];
};
const refresh = async () => { await act(async () => root.update(<Listes />)); };

test.each(['closed', 'reopened', 'backend', 'loading', 'error', 'removed', 'moved'])('confirmation ignorée après %s', async (change) => {
  await open();
  const confirm = await ask();
  if (change === 'closed' || change === 'reopened') {
    await act(async () => sheet().props.onClose());
    if (change === 'reopened') await act(async () => button('Ajouter une envie')());
  } else {
    if (change === 'backend') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
    else (useCollectionState as jest.Mock).mockReturnValue({ ...ready,
      ...(change === 'removed' ? { items: [] } : change === 'moved' ? { items: [{ ...item, list: 'shopping' }] } : { [change]: true }),
    });
    await refresh();
  }
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
  if (change === 'reopened') expect(sheet().props.title).toBe('Nouvelle envie');
});

test.each(['loading', 'error', 'removed'])('enregistrement bloqué après %s, brouillon conservé', async (change) => {
  await open();
  await act(async () => root.root.findByProps({ label: 'Quoi ?' }).props.onChangeText('Brouillon fictif'));
  const save = button('Enregistrer');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, ...(change === 'removed' ? { items: [] } : { [change]: true }) });
  await refresh();
  await act(async () => { await save(); });
  expect(backend.update).not.toHaveBeenCalled();
  expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe('Brouillon fictif');
});

test('enregistrer et confirmer la suppression partagent le verrou, y compris la fermeture', async () => {
  await open();
  const confirm = await ask();
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  const save = button('Enregistrer');
  await act(async () => { pending = save(); await confirm(); sheet().props.onClose(); });
  expect(backend.update).toHaveBeenCalledTimes(1);
  expect(backend.remove).not.toHaveBeenCalled();
  expect(sheet()).toBeTruthy();
  expect(root.root.findByProps({ label: 'Enregistrer' }).props.disabled).toBe(true);
  await act(async () => { finish(); await pending; });
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});

test.each(['save', 'remove'])('double %s : une seule mutation', async (action) => {
  await open();
  const perform = action === 'save' ? button('Enregistrer') : await ask();
  await act(async () => { await Promise.all([perform(), perform()]); });
  expect(backend.update.mock.calls.length + backend.remove.mock.calls.length).toBe(1);
});

test('une erreur conserve le brouillon et permet de réessayer', async () => {
  await open();
  backend.update.mockRejectedValueOnce(new Error('Erreur fictive'));
  await act(async () => { await button('Enregistrer')(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Erreur fictive');
  expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe(item.title);
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.update).toHaveBeenCalledTimes(2);
});

test('le nouveau brouillon ne change pas de catégorie avec l’onglet derrière le formulaire', async () => {
  await open(true);
  await act(async () => root.root.findByProps({ label: 'Quoi ?' }).props.onChangeText('Envie fictive'));
  await act(async () => root.root.findByType('segmented' as never).props.onChange('shopping'));
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.add).toHaveBeenCalledWith('items', expect.objectContaining({ list: 'bucket', title: 'Envie fictive' }));
});

test('un autre article reçoit son propre brouillon', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [item, { ...item, id: 'two', title: 'Autre envie' }] });
  await open();
  await act(async () => root.root.findAll((node) => typeof node.props.onLongPress === 'function' && typeof node.type !== 'string')[1].props.onPress());
  expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe('Autre envie');
});

test.each(['success', 'error'])('retour %s après remplacement de backend : ni fermeture ni erreur tardive', async (outcome) => {
  await open();
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
    finish = () => outcome === 'success' ? resolve() : reject(new Error('Ancienne erreur'));
  }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Enregistrer')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
  await refresh();
  await act(async () => { finish(); await pending; });
  expect(sheet()).toBeTruthy();
  expect(showDialog).not.toHaveBeenCalled();
});

test('un changement de membre efface le brouillon privé et invalide sa confirmation', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...item, list: 'gifts' }] });
  await act(async () => { root = create(<Listes />); });
  await act(async () => root.root.findByType('segmented' as never).props.onChange('gifts'));
  await act(async () => root.root.findAll((node) => typeof node.props.onLongPress === 'function')[0].props.onPress());
  const confirm = await ask();
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: 'bob' } });
  await refresh();
  await act(async () => { await confirm(); });
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
  expect(backend.remove).not.toHaveBeenCalled();
});

test('la propriété du cadeau est revalidée avant suppression', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...item, list: 'gifts' }] });
  await act(async () => { root = create(<Listes />); });
  await act(async () => root.root.findByType('segmented' as never).props.onChange('gifts'));
  await act(async () => root.root.findAll((node) => typeof node.props.onLongPress === 'function')[0].props.onPress());
  const confirm = await ask();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...item, list: 'gifts', createdBy: 'bob' }] });
  await refresh();
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
});

test('une liste rechargée permet de sauvegarder le brouillon sans le ressaisir', async () => {
  await open(true);
  await act(async () => root.root.findByProps({ label: 'Quoi ?' }).props.onChangeText('Brouillon repris'));
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await refresh();
  await act(async () => { await button('Enregistrer')(); button('Recharger la liste du formulaire')(); });
  expect(backend.add).not.toHaveBeenCalled();
  expect(ready.retry).toHaveBeenCalledTimes(1);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  await refresh();
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.add).toHaveBeenCalledWith('items', expect.objectContaining({ title: 'Brouillon repris' }));
});

test('un titre vide reste refusé même en appelant directement l’action', async () => {
  await open(true);
  await act(async () => { await button('Enregistrer')(); });
  expect(backend.add).not.toHaveBeenCalled();
});
