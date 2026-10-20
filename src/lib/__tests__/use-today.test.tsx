import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
import { useToday } from '../use-today';

jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  AppState: { value: { currentState: 'active', addEventListener: jest.fn() } },
}));
let root: ReactTestRenderer | undefined;
let onState: (state: AppStateStatus) => void;
const remove = jest.fn();
const rendered = jest.fn();
const snapshot = () => root?.toJSON();
function Day({ id }: { id: string }) {
  const day = useToday();
  rendered(id, day);
  return <>{day}</>;
}
async function mount(count = 1) {
  await act(async () => { root = create(<>{Array.from({ length: count }, (_, i) => <Day key={i} id={String(i)} />)}</>); });
}
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  jest.setSystemTime(new Date(2026, 9, 20, 23, 59, 59));
  AppState.currentState = 'active';
  jest.clearAllMocks();
  (AppState.addEventListener as jest.Mock).mockImplementation((_type, listener) => { onState = listener; return { remove }; });
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  jest.useRealTimers();
});

test('midnight updates the local date without external data or a parent render', async () => {
  await mount();
  expect(root?.toJSON()).toBe('2026-10-20');
  await act(async () => jest.advanceTimersByTime(1025));
  expect(root?.toJSON()).toBe('2026-10-21');
});

test.each([
  [2, 29, '2026-03-29', '2026-03-30'],
  [9, 25, '2026-10-25', '2026-10-26'],
] as const)('le jour civil reste correct pendant le changement horaire du mois %i', async (month, date, before, after) => {
  const start = new Date(2026, month, date);
  const nextMidnight = new Date(2026, month, date + 1);
  jest.setSystemTime(start);
  await mount();
  const renders = rendered.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(nextMidnight.getTime() - start.getTime() - 1));
  expect(snapshot()).toBe(before);
  expect(rendered).toHaveBeenCalledTimes(renders);
  await act(async () => jest.advanceTimersByTime(26));
  expect(snapshot()).toBe(after);
  expect(jest.getTimerCount()).toBe(1);
});

test('several consumers share one timer and one app-state listener', async () => {
  await mount(3);
  expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(1);
  await act(async () => jest.advanceTimersByTime(1025));
  expect(root?.toJSON()).toEqual(['2026-10-21', '2026-10-21', '2026-10-21']);
  await act(async () => root?.update(<Day id="remaining" />));
  expect(jest.getTimerCount()).toBe(1);
});

test('background stops the timer and resume catches up after several days', async () => {
  await mount();
  await act(async () => onState('background'));
  expect(jest.getTimerCount()).toBe(0);
  jest.setSystemTime(new Date(2026, 9, 23, 8));
  await act(async () => onState('active'));
  expect(snapshot()).toBe('2026-10-23');
  expect(jest.getTimerCount()).toBe(1);
});

test('mounting in background schedules no work until active', async () => {
  AppState.currentState = 'background';
  await mount();
  expect(jest.getTimerCount()).toBe(0);
  await act(async () => onState('active'));
  expect(jest.getTimerCount()).toBe(1);
});

test('inactive state pauses and an initially unknown state remains usable', async () => {
  AppState.currentState = 'unknown';
  await mount();
  expect(jest.getTimerCount()).toBe(1);
  await act(async () => onState('inactive'));
  expect(jest.getTimerCount()).toBe(0);
  await act(async () => onState('active'));
  expect(jest.getTimerCount()).toBe(1);
});

test('foreground clock changes are caught within a minute, including backward changes', async () => {
  jest.setSystemTime(new Date(2026, 9, 20, 12));
  await mount();
  jest.setSystemTime(new Date(2026, 9, 19, 12));
  await act(async () => jest.advanceTimersByTime(60_000));
  expect(root?.toJSON()).toBe('2026-10-19');
});

test('checks during the same day do not rerender consumers', async () => {
  jest.setSystemTime(new Date(2026, 9, 20, 12));
  await mount();
  const count = rendered.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(5 * 60_000));
  expect(rendered).toHaveBeenCalledTimes(count);
});

test('last unmount removes the listener and timer; a later mount reads a fresh day', async () => {
  await mount();
  await act(async () => root?.unmount());
  root = undefined;
  expect(remove).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  jest.setSystemTime(new Date(2026, 9, 23, 8));
  await mount();
  expect(snapshot()).toBe('2026-10-23');
  expect(jest.getTimerCount()).toBe(1);
});
