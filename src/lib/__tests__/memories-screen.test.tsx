import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Souvenirs from '@/app/souvenirs';
import { MemoriesStrip } from '@/components/home/memories-strip';
import { useCollectionState } from '../couple-context';
import { pickPhoto } from '../photos';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return { useCollection: () => state().items, useCollectionState: state, useSession: () => ({ backend: { userId: 'alice' } }) };
});
jest.mock('../photos', () => ({ pickPhoto: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
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

describe.each([['album', Souvenirs], ['accueil', MemoriesStrip]] as const)('%s', (_name, Component) => {
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
