import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, Text } from 'react-native';
import { celebrate, CelebrationLayer } from '@/components/celebrate';

jest.mock('@expo/vector-icons/Ionicons', () => 'icon');
jest.mock('@/constants/theme', () => ({ Fonts: {} }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  Animated: { value: {
    View: 'animated-view',
    Value: class { interpolate() { return 0; } },
    timing: jest.fn(), sequence: jest.fn(), delay: jest.fn(),
  } },
}));

let root: ReactTestRenderer;
const messages = () => root.root.findAllByType(Text).map(node => node.props.children);
const animation = () => ({ start: jest.fn(), stop: jest.fn() });
beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-20T15:00:00Z'), doNotFake: ['nextTick', 'queueMicrotask'] });
  jest.clearAllMocks();
  (Animated.timing as jest.Mock).mockImplementation(animation);
  (Animated.sequence as jest.Mock).mockImplementation(animation);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });
const mount = async () => { await act(async () => { root = create(<CelebrationLayer />); }); };

test('un ancien délai ne retire pas une nouvelle fête portant le même horodatage', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(123);
  await mount();
  await act(async () => celebrate('confetti'));
  await act(async () => jest.advanceTimersByTime(100));
  await act(async () => celebrate('hearts', 'Message fictif récent'));
  await act(async () => jest.advanceTimersByTime(2300));
  expect(messages()).toContain('Message fictif récent');
  await act(async () => jest.advanceTimersByTime(600));
  expect(messages()).toHaveLength(0);
});

test('remplacer une fête ne laisse qu’un délai actif', async () => {
  await mount();
  await act(async () => { celebrate('hearts'); celebrate('confetti'); });
  expect(jest.getTimerCount()).toBe(1);
});

test('le démontage retire le délai et l’abonnement aux célébrations', async () => {
  await mount();
  await act(async () => celebrate('hearts'));
  await act(async () => root.unmount());
  expect(jest.getTimerCount()).toBe(0);
  await act(async () => celebrate('confetti'));
  expect(jest.getTimerCount()).toBe(0);
});

test('les animations natives de particules et du message sont arrêtées au démontage', async () => {
  await mount();
  await act(async () => celebrate('hearts', 'Message fictif'));
  const particles = (Animated.timing as jest.Mock).mock.results.map(result => result.value).filter(value => value.start.mock.calls.length);
  const message = (Animated.sequence as jest.Mock).mock.results[0].value;
  expect(particles).toHaveLength(14);
  await act(async () => root.unmount());
  expect(particles.every(value => value.stop.mock.calls.length === 1)).toBe(true);
  expect(message.stop).toHaveBeenCalledTimes(1);
});

test('le délai normal retire le message courant après 2,9 secondes', async () => {
  await mount();
  await act(async () => celebrate('hearts', 'Message fictif'));
  await act(async () => jest.advanceTimersByTime(2899));
  expect(messages()).toEqual(['Message fictif']);
  await act(async () => jest.advanceTimersByTime(1));
  expect(messages()).toHaveLength(0);
});
