import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Listes from '@/app/(tabs)/listes';
import Restos from '@/app/(tabs)/restos';
import { useCollectionState, useSession } from '../couple-context';
import { showDialog } from '@/components/dialog';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return { useCollection: (name: string) => state(name).items, useCollectionState: state, useSession: jest.fn() };
});
jest.mock('../haptics', () => ({ success: jest.fn(), tap: jest.fn() }));
jest.mock('@/components/celebrate', () => ({ celebrate: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), Fonts: {} }));
jest.mock('expo-image', () => ({ Image: (props: object) => jest.requireActual('react').createElement('image', props) }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return { confirmDelete: jest.fn(), ...Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'IconButton', 'Row', 'Dot', 'Empty', 'Fab', 'Ionicons', 'Field', 'Chips', 'Segmented', 'Sheet', 'ProgressBar'].map((name) => [
    name, (props: object) => React.createElement(name.toLowerCase(), props),
  ])) };
});

let root: ReactTestRenderer;
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const backend = { userId: 'alice', mode: 'cloud', add: jest.fn(), remove: jest.fn(), clearShoppingBasket: jest.fn(), update: jest.fn(), call: jest.fn() };
beforeEach(() => {
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  (useSession as jest.Mock).mockReturnValue({ backend, partner: { name: 'Bob' }, colorOf: () => '#000', nameOf: () => 'Alice' });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });
const text = () => JSON.stringify(root.toJSON());
const switchTab = async (value: string) => { await act(async () => { root.root.findByType('segmented' as never).props.onChange(value); }); };

test.each([false, true])('les cadeaux locaux expliquent l’accès sur le même téléphone (liste remplie : %s)', async populated => {
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, mode: 'local' }, partner: { name: 'Bob' }, colorOf: () => '#000' });
  if (populated) (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ id: 'gift', title: 'Idée fictive', createdBy: 'alice', done: false, createdAt: 1 }] });
  await act(async () => { root = create(<Listes />); });
  await switchTab('gifts');
  expect(text()).toContain('ne sont pas protégées');
  expect(text()).not.toContain('ne la voit pas');
  expect(text()).not.toContain('secrètes');
  expect(text()).not.toContain('ne verra jamais');
});

test('les cadeaux synchronisés conservent leur explication de liste privée', async () => {
  await act(async () => { root = create(<Listes />); });
  await switchTab('gifts');
  expect(text()).toContain('Liste privée');
  expect(text()).not.toContain('ne sont pas protégées');
});

test('vider le panier utilise une seule opération, sans suppressions individuelles partielles', async () => {
  const item = { list: 'shopping', title: 'Article fictif', createdBy: 'alice', done: true, createdAt: 1 };
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...item, id: 'one' }, { ...item, id: 'two' }] });
  await act(async () => { root = create(<Listes />); });
  await switchTab('shopping');
  await act(async () => { root.root.findByProps({ label: 'Vider les articles cochés' }).props.onPress(); });
  const confirm = (showDialog as jest.Mock).mock.calls[0][2].find((button: { text: string }) => button.text === 'Vider').onPress;
  await act(async () => { await confirm(); });
  expect(backend.clearShoppingBasket).toHaveBeenCalledWith(['one', 'two']);
  expect(backend.remove).not.toHaveBeenCalled();
});

describe.each(['bucket', 'films', 'shopping', 'gifts'])('liste %s', (tab) => {
  test.each(['loading', 'error'])('une lecture en %s n’est pas présentée comme une liste vide', async (status) => {
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
    await act(async () => { root = create(<Listes />); });
    await switchTab(tab);
    expect(root.root.findAllByType('empty' as never)).toHaveLength(0);
    expect(root.root.findAllByType('progressbar' as never)).toHaveLength(0);
    expect(text()).toContain(status === 'loading' ? 'Chargement de la liste' : 'Liste indisponible');
    if (status === 'error') {
      await act(async () => { root.root.findByProps({ label: 'Réessayer la liste' }).props.onPress(); });
      expect(ready.retry).toHaveBeenCalledTimes(1);
    }
    expect(backend.remove).not.toHaveBeenCalled();
    expect(backend.add).not.toHaveBeenCalled();
  });
});

test('les cadeaux et les listes partagées échouent et se relancent indépendamment', async () => {
  const retryItems = jest.fn();
  const retryGifts = jest.fn();
  const item = { id: 'item', list: 'bucket', title: 'Rêve fictif', createdBy: 'alice', done: false, createdAt: 1 };
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'items' ? { ...ready, items: [item], retry: retryItems } : { ...ready, error: true, retry: retryGifts });
  await act(async () => { root = create(<Listes />); });
  expect(text()).toContain('Rêve fictif');
  expect(text()).not.toContain('Liste indisponible');
  await switchTab('gifts');
  await act(async () => { root.root.findByProps({ label: 'Réessayer la liste' }).props.onPress(); });
  expect(retryGifts).toHaveBeenCalledTimes(1);
  expect(retryItems).not.toHaveBeenCalled();
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'items' ? { ...ready, error: true, retry: retryItems } : { ...ready, retry: retryGifts });
  await act(async () => { root.update(<Listes />); });
  expect(text()).not.toContain('Liste indisponible');
  expect(root.root.findAllByType('empty' as never)).toHaveLength(1);
  await switchTab('bucket');
  await act(async () => { root.root.findByProps({ label: 'Réessayer la liste' }).props.onPress(); });
  expect(retryItems).toHaveBeenCalledTimes(1);
});

test('le filtre des cadeaux reste limité au membre connecté après reprise', async () => {
  const gift = { id: 'mine', title: 'Mon idée fictive', createdBy: 'alice', done: false, createdAt: 1 };
  const loaded = (name: string) => name === 'gifts' ? { ...ready, items: [gift, { ...gift, id: 'other', createdBy: 'bob', title: 'Autre idée fictive' }] } : ready;
  (useCollectionState as jest.Mock).mockImplementation(loaded);
  await act(async () => { root = create(<Listes />); });
  await switchTab('gifts');
  expect(text()).toContain('Mon idée fictive');
  expect(text()).not.toContain('Autre idée fictive');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await act(async () => { root.update(<Listes />); });
  expect(text()).not.toContain('Mon idée fictive');
  (useCollectionState as jest.Mock).mockImplementation(loaded);
  await act(async () => { root.update(<Listes />); });
  expect(text()).toContain('Mon idée fictive');
  expect(text()).not.toContain('Autre idée fictive');
});

test.each(['bucket', 'films', 'shopping', 'gifts'])('la liste %s masque aussi ses anciennes entrées en erreur', async (tab) => {
  const entry = { id: 'entry', list: tab, title: 'Entrée fictive', createdBy: 'alice', done: true, createdAt: 1 };
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [entry] });
  await act(async () => { root = create(<Listes />); });
  await switchTab(tab);
  expect(text()).toContain('Entrée fictive');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true, items: [entry] });
  await act(async () => { root.update(<Listes />); });
  expect(text()).not.toContain('Entrée fictive');
  expect(root.root.findAllByType('progressbar' as never)).toHaveLength(0);
  expect(root.root.findAllByProps({ label: 'Vider les articles cochés' })).toHaveLength(0);
  expect(root.root.findAllByProps({ label: 'Tirer un film au sort' })).toHaveLength(0);
  expect(backend.remove).not.toHaveBeenCalled();
});

test('un brouillon de liste est conservé pendant la panne', async () => {
  await act(async () => { root = create(<Listes />); });
  await act(async () => { root.root.findByProps({ label: 'Ajouter une envie' }).props.onPress(); });
  await act(async () => { root.root.findByProps({ label: 'Quoi ?' }).props.onChangeText('Envie en préparation'); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await act(async () => { root.update(<Listes />); });
  expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe('Envie en préparation');
});

test.each(['loading', 'error'])('les restaurants en %s n’affichent ni faux compteur ni tirage', async (status) => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
  await act(async () => { root = create(<Restos />); });
  expect(text()).not.toContain('0 adresse');
  expect(text()).not.toContain('À tester · 0');
  expect(root.root.findAllByType('empty' as never)).toHaveLength(0);
  expect(root.root.findAllByProps({ label: 'Tirer un resto au sort' })).toHaveLength(0);
  expect(text()).toContain(status === 'loading' ? 'Chargement des restos' : 'Restos indisponibles');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer les restos' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
  expect(backend.call).not.toHaveBeenCalled();
});

test('une liste de restaurants vide confirmée conserve ses vrais compteurs et son ajout', async () => {
  await act(async () => { root = create(<Restos />); });
  expect(text()).toContain('0 adresse');
  expect(root.root.findByProps({ label: 'Ajouter un resto' })).toBeTruthy();
});

test('un restaurant et ses compteurs reviennent après reprise sans perdre le brouillon', async () => {
  const resto = { id: 'resto', name: 'Resto fictif', status: 'envie', createdBy: 'alice', createdAt: 1 };
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [resto] });
  await act(async () => { root = create(<Restos />); });
  expect(text()).toContain('Resto fictif');
  expect(text()).toContain('À tester · 1');
  await act(async () => { root.root.findByProps({ label: 'Ajouter un resto' }).props.onPress(); });
  await act(async () => { root.root.findByProps({ label: 'Nom' }).props.onChangeText('Nom en préparation'); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true, items: [resto] });
  await act(async () => { root.update(<Restos />); });
  expect(text()).not.toContain('Resto fictif');
  expect(text()).not.toContain('À tester · 1');
  expect(root.root.findByProps({ label: 'Nom' }).props.value).toBe('Nom en préparation');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [resto] });
  await act(async () => { root.update(<Restos />); });
  expect(text()).toContain('Resto fictif');
  expect(root.root.findByProps({ label: 'Nom' }).props.value).toBe('Nom en préparation');
  expect(backend.call).not.toHaveBeenCalled();
});
