import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Listes from '@/app/(tabs)/listes';
import { useCollectionState, useSession } from '../couple-context';
import { confirmDelete } from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { tap } from '../haptics';

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
const item = { id: 'one', list: 'shopping', title: 'Course fictive', done: true, createdBy: 'alice', createdAt: 1 };
const ready = { items: [item], loading: false, error: false, retry: jest.fn() };
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', remove: jest.fn(), clearShoppingBasket: jest.fn(), update: jest.fn(), add: jest.fn() };
const session = { backend, partner: null, colorOf: () => '#000' };
beforeEach(() => {
  jest.clearAllMocks();
  backend.remove.mockReset().mockResolvedValue(undefined);
  backend.clearShoppingBasket.mockReset().mockResolvedValue(undefined);
  backend.update.mockReset().mockResolvedValue(undefined);
  backend.add.mockReset().mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue(session);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const switchTab = async (tab: string) => { await act(async () => { root.root.findByType('segmented' as never).props.onChange(tab); }); };
const open = async () => {
  await act(async () => { root = create(<Listes />); });
  await switchTab('shopping');
};
const askBasket = async () => {
  await open();
  await act(async () => { root.root.findByProps({ label: 'Vider les articles cochés' }).props.onPress(); });
  return (showDialog as jest.Mock).mock.calls[0][2].find((b: { text: string }) => b.text === 'Vider').onPress;
};
const askOne = async () => {
  await open();
  await act(async () => { root.root.findAll((node) => typeof node.props.onLongPress === 'function')[0].props.onLongPress(); });
  return (confirmDelete as jest.Mock).mock.calls[0][1];
};
const change = async (kind: string) => {
  if (kind === 'unmount') { await act(async () => root.unmount()); return; }
  if (kind === 'tab') { await switchTab('films'); return; }
  if (kind === 'backend') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: 'bob' } });
  else if (kind === 'removed') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [] });
  else (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [kind]: true });
  await act(async () => root.update(<Listes />));
};

describe.each([['panier', askBasket], ['article', askOne]] as const)('confirmation %s', (_kind, ask) => {
  test.each(['unmount', 'backend', 'tab', 'loading', 'error', 'removed'])('après %s, aucune suppression', async (kind) => {
    const confirm = await ask();
    await change(kind);
    await act(async () => { await confirm(); });
    expect(backend.clearShoppingBasket).not.toHaveBeenCalled();
    expect(backend.remove).not.toHaveBeenCalled();
  });
  test('un double appui ne lance qu’une opération', async () => {
    const confirm = await ask();
    await act(async () => { await Promise.all([confirm(), confirm()]); });
    expect(backend.clearShoppingBasket.mock.calls.length + backend.remove.mock.calls.length).toBe(1);
  });
  test('revenir sur le même onglet ne réactive pas l’ancienne confirmation', async () => {
    const confirm = await ask();
    await switchTab('films');
    await switchTab('shopping');
    await act(async () => { await confirm(); });
    expect(backend.clearShoppingBasket).not.toHaveBeenCalled();
    expect(backend.remove).not.toHaveBeenCalled();
  });
});

test('le panier confirmé exclut les articles décochés et ceux ajoutés après le dialogue', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [item, { ...item, id: 'two' }] });
  const confirm = await askBasket();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...item, done: false }, { ...item, id: 'two' }, { ...item, id: 'new' }] });
  await act(async () => root.update(<Listes />));
  await act(async () => { await confirm(); });
  expect(backend.clearShoppingBasket).toHaveBeenCalledWith(['two']);
});

test('un échec de panier est visible et une nouvelle tentative reste possible', async () => {
  const confirm = await askBasket();
  backend.clearShoppingBasket.mockRejectedValueOnce(new Error('Refus fictif'));
  await act(async () => { await confirm(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Refus fictif');
  await act(async () => { await confirm(); });
  expect(backend.clearShoppingBasket).toHaveBeenCalledTimes(2);
});

test('un double appui sur une case ne lance qu’une modification', async () => {
  await open();
  const toggle = root.root.findAllByProps({ accessibilityRole: 'checkbox' }).find((node) => typeof node.props.onPress === 'function')!.props.onPress;
  await act(async () => { await Promise.all([toggle(), toggle()]); });
  expect(backend.update).toHaveBeenCalledTimes(1);
});

test('un ancien gestionnaire utilise la valeur courante avant de cocher', async () => {
  await open();
  const toggle = root.root.findAllByProps({ accessibilityRole: 'checkbox' }).find((node) => typeof node.props.onPress === 'function')!.props.onPress;
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...item, done: false }] });
  await act(async () => root.update(<Listes />));
  await act(async () => { await toggle(); });
  expect(backend.update).toHaveBeenCalledWith('items', 'one', { done: true });
});

test.each(['success', 'error'])('un retour %s après changement d’onglet ne produit pas de retour visuel tardif', async (outcome) => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...item, done: false }] });
  await open();
  let finish!: () => void;
  backend.update.mockImplementationOnce(() => new Promise<void>((resolve, reject) => { finish = () => outcome === 'success' ? resolve() : reject(new Error('Ancien échec')); }));
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findAllByProps({ accessibilityRole: 'checkbox' }).find((node) => typeof node.props.onPress === 'function')!.props.onPress(); });
  await switchTab('films');
  await act(async () => { finish(); await pending; });
  expect(tap).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});
