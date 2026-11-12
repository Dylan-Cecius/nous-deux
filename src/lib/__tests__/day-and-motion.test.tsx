import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { useTodayKey } from '../use-today';
import { useReducedMotion } from '../use-reduced-motion';

let root: ReactTestRenderer | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('la question du jour change à minuit et nettoie son minuteur', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 12, 23, 59, 59));
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
  const schedule = jest.spyOn(globalThis, 'setTimeout');
  const clear = jest.spyOn(globalThis, 'clearTimeout');
  let today = '';
  function Day() { today = useTodayKey(); return null; }
  await act(async () => { root = create(<Day />); });
  expect(today).toBe('2026-11-12');
  await act(async () => { jest.advanceTimersByTime(1100); });
  expect(today).toBe('2026-11-13');
  const dailyTimerIndex = schedule.mock.calls.findIndex((call) => Number(call[1]) > 86_000_000);
  expect(dailyTimerIndex).toBeGreaterThanOrEqual(0);
  const dailyTimer = schedule.mock.results[dailyTimerIndex].value;
  await act(async () => { root?.unmount(); });
  root = undefined;
  expect(remove).toHaveBeenCalledTimes(1);
  expect(clear).toHaveBeenCalledWith(dailyTimer);
});

test('le retour au premier plan reprend le jour local après plusieurs jours', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 12, 12));
  let foreground!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    foreground = listener;
    return { remove: jest.fn() };
  });
  let today = '';
  function Day() { today = useTodayKey(); return null; }
  await act(async () => { root = create(<Day />); });
  jest.setSystemTime(new Date(2026, 10, 15, 12));
  await act(async () => { foreground('active'); });
  expect(today).toBe('2026-11-15');
});

test('la préférence réduction des animations est chargée et suivie en direct', async () => {
  let changed!: (reduced: boolean) => void;
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, listener) => {
    changed = listener as unknown as (value: boolean) => void;
    return { remove } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
  let reduced = true;
  function Motion() { reduced = useReducedMotion(); return null; }
  await act(async () => { root = create(<Motion />); });
  expect(reduced).toBe(false);
  await act(async () => { changed(true); });
  expect(reduced).toBe(true);
  await act(async () => { root?.unmount(); });
  root = undefined;
  expect(remove).toHaveBeenCalledTimes(1);
});
