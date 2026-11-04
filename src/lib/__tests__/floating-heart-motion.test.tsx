import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, View } from 'react-native';
import { useFloatingHeartMotion } from '../use-floating-heart-motion';
import { useReducedMotion } from '../use-reduced-motion';

jest.mock('../use-reduced-motion', () => ({ useReducedMotion: jest.fn() }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  Animated: { value: {
    Value: class { interpolate(config: object) { return config; } },
    loop: jest.fn(), sequence: jest.fn(), timing: jest.fn(),
  } },
}));

// Test only the controller. No image fixture replaces the unavailable logo.
function Probe({ duration = 2000 }: { duration?: number }) {
  const { translateY, scale } = useFloatingHeartMotion(duration);
  return <View style={{ transform: [{ translateY }, { scale }] }} />;
}
let root: ReactTestRenderer;
const loops = () => (Animated.loop as jest.Mock).mock.results.map(result => result.value);
beforeEach(() => {
  jest.clearAllMocks();
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  (Animated.loop as jest.Mock).mockImplementation(() => ({ start: jest.fn(), stop: jest.fn() }));
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test('préférence réduite : aucun appel animé et transformation neutre', async () => {
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await act(async () => { root = create(<Probe />); });
  expect(Animated.timing).not.toHaveBeenCalled();
  expect(Animated.loop).not.toHaveBeenCalled();
  expect(root.root.findByType(View).props.style.transform).toEqual([{ translateY: 0 }, { scale: 1 }]);
});

test.each([1800, 2000])('sans réduction, préserve la durée %s et les amplitudes existantes', async (duration) => {
  await act(async () => { root = create(<Probe duration={duration} />); });
  expect((Animated.timing as jest.Mock).mock.calls.map(([, config]) => ({ ...config, easing: undefined }))).toEqual([
    { toValue: 1, duration, useNativeDriver: true, easing: undefined },
    { toValue: 0, duration, useNativeDriver: true, easing: undefined },
  ]);
  expect(root.root.findByType(View).props.style.transform).toEqual([
    { translateY: { inputRange: [0, 1], outputRange: [0, -8] } },
    { scale: { inputRange: [0, 1], outputRange: [1, 1.04] } },
  ]);
  expect(loops()[0].start).toHaveBeenCalledTimes(1);
});

test('activation puis désactivation : arrêt et nouvelle boucle, sans recréer une boucle au simple rendu', async () => {
  await act(async () => { root = create(<Probe />); });
  await act(async () => root.update(<Probe />));
  expect(loops()).toHaveLength(1);
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  await act(async () => root.update(<Probe />));
  expect(loops()[0].stop).toHaveBeenCalledTimes(1);
  expect(root.root.findByType(View).props.style.transform).toEqual([{ translateY: 0 }, { scale: 1 }]);
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  await act(async () => root.update(<Probe />));
  expect(loops()).toHaveLength(2);
  expect(loops()[1].start).toHaveBeenCalledTimes(1);
});

test('changement de durée et démontage arrêtent chacun la bonne boucle', async () => {
  await act(async () => { root = create(<Probe duration={1800} />); });
  await act(async () => root.update(<Probe duration={2000} />));
  expect(loops()[0].stop).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  expect(loops()[1].stop).toHaveBeenCalledTimes(1);
});
