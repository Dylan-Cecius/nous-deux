import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, StyleSheet } from 'react-native';
import { PingCard } from '@/components/home/love-cards';
import { useReducedMotion } from '../use-reduced-motion';
import { sendLoveNote } from '../assistant';

jest.mock('../use-reduced-motion', () => ({ useReducedMotion: jest.fn() }));
jest.mock('../couple-context', () => ({
  useSession: () => ({ backend: { mode: 'local', coupleId: 'demo', userId: 'alice' }, partner: { id: 'bob', name: 'Bob fictif' } }),
  useCollectionState: () => ({ items: [], loading: false, error: false }),
}));
jest.mock('../assistant', () => ({ sendLoveNote: jest.fn() }));
jest.mock('../haptics', () => ({ bump: jest.fn(), success: jest.fn() }));
jest.mock('@/components/celebrate', () => ({ celebrate: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), cardShadow: () => ({}), Fonts: {} }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Card', 'T', 'Button', 'IconButton', 'Row', 'Dot', 'Ionicons', 'Field'].map(name => [name, (props: object) => React.createElement(name.toLowerCase(), props)]));
});
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  Animated: { value: {
    View: 'animated-view', Value: class {},
    timing: jest.fn(), sequence: jest.fn(), loop: jest.fn(),
  } },
}));

let root: ReactTestRenderer;
const start = jest.fn(), stop = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  (Animated.loop as jest.Mock).mockReturnValue({ start, stop });
  (sendLoveNote as jest.Mock).mockResolvedValue(undefined);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const mount = async () => { await act(async () => { root = create(<PingCard />); }); };
const scale = () => StyleSheet.flatten(root.root.findByType('animated-view' as never).props.style).transform[0].scale;

test('réduction activée : cœur immobile sans boucle native', async () => {
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await mount();
  expect(Animated.loop).not.toHaveBeenCalled();
  expect(scale()).toBe(1);
  const button = root.root.findByProps({ accessibilityLabel: 'Enregistrer un cœur sur ce téléphone' });
  expect(StyleSheet.flatten(button.props.style({ pressed: true })).transform).toEqual([{ scale: 1 }]);
});

test('activation en direct : ancienne boucle arrêtée et taille neutre immédiate', async () => {
  await mount();
  expect(start).toHaveBeenCalledTimes(1);
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await act(async () => root.update(<PingCard />));
  expect(stop).toHaveBeenCalledTimes(1);
  expect(scale()).toBe(1);
});

test('désactivation en direct : animation disponible, puis arrêt au démontage', async () => {
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await mount();
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  await act(async () => root.update(<PingCard />));
  expect(start).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  expect(stop).toHaveBeenCalledTimes(1);
});

test('sans mouvement, le bouton conserve son action locale explicite', async () => {
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await mount();
  await act(async () => root.root.findByProps({ accessibilityLabel: 'Enregistrer un cœur sur ce téléphone' }).props.onPress());
  expect(sendLoveNote).toHaveBeenCalledTimes(1);
  expect(root.root.findAllByType('t' as never).some(node => node.props.children === 'Cœur enregistré !')).toBe(true);
});
