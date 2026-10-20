import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { celebrate, CelebrationLayer } from '@/components/celebrate';

jest.mock('@expo/vector-icons/Ionicons', () => 'icon');
jest.mock('@/constants/theme', () => ({ Fonts: {} }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  AccessibilityInfo: { value: { isReduceMotionEnabled: jest.fn(), addEventListener: jest.fn() } },
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
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(false);
  (AccessibilityInfo.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });
const mount = async () => { await act(async () => { root = create(<CelebrationLayer />); }); };

test.each(['enabled', 'pending', 'rejected', 'throws'])('réduction du mouvement %s : message conservé sans animation', async (state) => {
  const read = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
  if (state === 'enabled') read.mockResolvedValue(true);
  else if (state === 'pending') read.mockReturnValue(new Promise(() => {}));
  else if (state === 'rejected') read.mockRejectedValue(new Error('Lecture fictive refusée'));
  else read.mockImplementation(() => { throw new Error('Lecture fictive impossible'); });
  await mount();
  await act(async () => celebrate('hearts', 'Message fictif sans mouvement'));
  expect(messages()).toEqual(['Message fictif sans mouvement']);
  expect(Animated.timing).not.toHaveBeenCalled();
  expect(Animated.sequence).not.toHaveBeenCalled();
  expect(root.root.findAllByType('icon' as never)).toHaveLength(0);
});

test('activer la réduction arrête la fête courante sans retirer son message', async () => {
  await mount();
  await act(async () => celebrate('hearts', 'Message fictif'));
  const running = (Animated.timing as jest.Mock).mock.results.map(result => result.value).filter(value => value.start.mock.calls.length);
  const subscription = (AccessibilityInfo.addEventListener as jest.Mock).mock.calls.find(([name]) => name === 'reduceMotionChanged');
  expect(subscription).toBeDefined();
  await act(async () => subscription![1](true));
  expect(running.every(value => value.stop.mock.calls.length === 1)).toBe(true);
  expect(root.root.findAllByType('icon' as never)).toHaveLength(0);
  expect(messages()).toEqual(['Message fictif']);
});

test('une lecture initiale lente ne remplace pas un réglage plus récent', async () => {
  let resolve!: (value: boolean) => void;
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockReturnValue(new Promise<boolean>(r => { resolve = r; }));
  await mount();
  const change = (AccessibilityInfo.addEventListener as jest.Mock).mock.calls.find(([name]) => name === 'reduceMotionChanged')?.[1];
  expect(change).toBeDefined();
  await act(async () => { change(true); resolve(false); });
  await act(async () => celebrate('confetti', 'Message fictif'));
  expect(Animated.timing).not.toHaveBeenCalled();
});

test('désactiver la réduction autorise les célébrations suivantes', async () => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  await mount();
  const change = (AccessibilityInfo.addEventListener as jest.Mock).mock.calls.find(([name]) => name === 'reduceMotionChanged')?.[1];
  expect(change).toBeDefined();
  await act(async () => change(false));
  await act(async () => celebrate('confetti'));
  expect((Animated.timing as jest.Mock).mock.results.filter(result => result.value.start.mock.calls.length)).toHaveLength(44);
});

test('le démontage retire l’écoute du réglage et ignore une réponse tardive', async () => {
  let resolve!: (value: boolean) => void;
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockReturnValue(new Promise<boolean>(r => { resolve = r; }));
  await mount();
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));
  const subscription = (AccessibilityInfo.addEventListener as jest.Mock).mock.results[0].value;
  await act(async () => root.unmount());
  await act(async () => resolve(false));
  expect(subscription.remove).toHaveBeenCalledTimes(1);
  expect(Animated.timing).not.toHaveBeenCalled();
});

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
