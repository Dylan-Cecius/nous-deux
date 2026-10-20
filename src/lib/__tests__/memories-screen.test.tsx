import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import Souvenirs from '@/app/souvenirs';
import { MemoriesStrip } from '@/components/home/memories-strip';
import { useCollectionState } from '../couple-context';
import { pickPhoto } from '../photos';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  const backend = { userId: 'alice', uploadPhoto: jest.fn().mockResolvedValue('test://uploaded'), add: jest.fn().mockResolvedValue(undefined) };
  return { testBackend: backend, useCollection: () => state().items, useCollectionState: state, useSession: () => ({ backend }) };
});
jest.mock('../photos', () => ({ pickPhoto: jest.fn() }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { Pressable: { value: 'pressable' } }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), canGoBack: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: (props: object) => jest.requireActual('react').createElement('image', props) }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}) }));
jest.mock('@/components/pickers', () => ({ DateField: () => null }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return { confirmDelete: jest.fn(), ...Object.fromEntries(['Screen', 'SectionTitle', 'Card', 'T', 'Button', 'Fab', 'Row', 'Empty', 'Ionicons', 'Sheet', 'Field'].map((name) => [
    name, (props: object) => React.createElement(name.toLowerCase(), props),
  ])) };
});

let root: ReactTestRenderer;
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const memory = { id: 'memory', caption: 'Souvenir fictif', date: '2025-10-15', createdAt: 1, photoUrl: 'test://photo' };
beforeEach(() => { (useCollectionState as jest.Mock).mockReturnValue(ready); });
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });
const text = () => JSON.stringify(root.toJSON());

test.each([true, false])('retour des souvenirs avec historique : %s', async (hasHistory) => {
  (router.canGoBack as jest.Mock).mockReturnValue(hasHistory);
  await act(async () => { root = create(<Souvenirs />); });
  await act(async () => { root.root.findByType('screen' as never).props.onBack(); });
  expect(router.back).toHaveBeenCalledTimes(hasHistory ? 1 : 0);
  if (hasHistory) expect(router.replace).not.toHaveBeenCalled();
  else expect(router.replace).toHaveBeenCalledWith('/');
});

describe.each([['album', Souvenirs], ['accueil', MemoriesStrip]] as const)('%s', (_name, Component) => {
  test.each(['loading', 'error'])('le vrai bouton n’envoie pas une photo choisie après passage en %s', async (status) => {
    let finish!: (value: unknown) => void;
    (pickPhoto as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => { root = create(<Component />); });
    const add = _name === 'album'
      ? root.root.findByProps({ label: 'Ajouter une photo' }).props.onPress
      : root.root.findByProps({ accessibilityLabel: 'Ajouter un souvenir' }).props.onPress;
    let pending!: Promise<void>;
    await act(async () => { pending = add(); });
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
    await act(async () => { root.update(<Component />); });
    await act(async () => { finish({ uri: 'test://picked' }); await pending; await add(); });
    expect(pickPhoto).toHaveBeenCalledTimes(1);
    expect(jest.requireMock('../couple-context').testBackend.uploadPhoto).not.toHaveBeenCalled();
    expect(jest.requireMock('../couple-context').testBackend.add).not.toHaveBeenCalled();
  });

  test.each(['loading', 'error'])('des souvenirs en %s ne ressemblent pas à un album vide', async (status) => {
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
    await act(async () => { root = create(<Component />); });
    expect(text()).not.toContain('0 photo');
    expect(text()).not.toContain('Ajoutez vos');
    expect(text()).toContain(status === 'loading' ? 'Chargement des souvenirs' : 'Souvenirs indisponibles');
    expect(pickPhoto).not.toHaveBeenCalled();
    if (status === 'error') {
      await act(async () => { root.root.findByProps({ label: 'Réessayer les souvenirs' }).props.onPress(); });
      expect(ready.retry).toHaveBeenCalledTimes(1);
    }
  });

  test('les photos sont masquées après une erreur et reviennent à la reprise', async () => {
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [memory] });
    await act(async () => { root = create(<Component />); });
    expect(root.root.findAllByType('image' as never).length).toBeGreaterThan(0);
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true, items: [memory] });
    await act(async () => { root.update(<Component />); });
    expect(root.root.findAllByType('image' as never)).toHaveLength(0);
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [memory] });
    await act(async () => { root.update(<Component />); });
    expect(root.root.findAllByType('image' as never).length).toBeGreaterThan(0);
  });

  test('un album réellement vide propose toujours l’ajout', async () => {
    await act(async () => { root = create(<Component />); });
    expect(text()).toContain('Ajoutez vos');
    expect(text()).not.toContain('indisponibles');
  });
});

test('la légende en cours de modification reste conservée pendant une erreur de lecture', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [memory] });
  await act(async () => { root = create(<Souvenirs />); });
  const photoButton = root.root.findAll((node) => typeof node.props.onPress === 'function' && node.props.style?.width === '48%')[0];
  await act(async () => { photoButton.props.onPress(); });
  await act(async () => { root.root.findByProps({ label: 'Légende' }).props.onChangeText('Légende en préparation'); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await act(async () => { root.update(<Souvenirs />); });
  expect(root.root.findByProps({ label: 'Légende' }).props.value).toBe('Légende en préparation');
});

describe.each([['album', Souvenirs], ['accueil', MemoriesStrip]] as const)('accessibilité %s', (name, Component) => {
  test.each(['Souvenir fictif', ''])('la miniature %s annonce son action et sa date complète', async caption => {
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...memory, caption }] });
    await act(async () => { root = create(<Component />); });
    const photo = root.root.findAllByType(Pressable).find(node => node.findAllByType('image' as never).length > 0)!;
    expect(photo.props.accessibilityRole).toBe('button');
    expect(photo.props.accessibilityLabel).toContain('15 octobre 2025');
    if (caption) expect(photo.props.accessibilityLabel).toContain(caption);
    expect(photo.props.accessibilityHint).toBe(name === 'album' ? 'Ouvre la fiche pour modifier ce souvenir.' : 'Ouvre l’album des souvenirs.');
  });
});

test('l’ajout de l’accueil annonce son attente puis son retour disponible', async () => {
  let finish!: (value: unknown) => void;
  (pickPhoto as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await act(async () => { root = create(<MemoriesStrip />); });
  const getButton = () => root.root.findByProps({ accessibilityLabel: 'Ajouter un souvenir' });
  let pending!: Promise<void>;
  await act(async () => { pending = getButton().props.onPress(); });
  expect(getButton().props.accessibilityState).toEqual({ busy: true, disabled: true });
  await act(async () => { finish(null); await pending; });
  expect(getButton().props.accessibilityState).toEqual({ busy: false, disabled: false });
});
