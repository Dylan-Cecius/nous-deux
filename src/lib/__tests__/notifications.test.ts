import * as Notifications from 'expo-notifications';
import { clearReminders, scheduleCountdownReminders } from '../notifications';
import type { SpecialDate } from '../types';

jest.mock('expo-constants', () => ({
  __esModule: true, default: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  dismissAllNotificationsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

type Scheduled = { identifier: string; content: { body?: string; data?: { kind: string } } };
const scheduled = new Map<string, Scheduled>();
const dates: SpecialDate[] = [{ id: 'date', title: 'Date fictive', date: '2099-12-20', yearly: false, emoji: '' }];
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  scheduled.clear();
  jest.clearAllMocks();
  let nextId = 0;
  (Notifications.getPermissionsAsync as jest.Mock).mockReset().mockResolvedValue({ granted: true });
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockReset().mockImplementation(async () => [...scheduled.values()]);
  (Notifications.scheduleNotificationAsync as jest.Mock).mockReset().mockImplementation(async ({ content }) => {
    const identifier = `notification-${++nextId}`;
    scheduled.set(identifier, { identifier, content });
    return identifier;
  });
  (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockReset().mockImplementation(async (id) => { scheduled.delete(id); });
  (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockReset().mockImplementation(async () => { scheduled.clear(); });
  (Notifications.dismissAllNotificationsAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
});

test('une ancienne vérification de permission ne peut annuler les nouveaux rappels', async () => {
  const permission = deferred<{ granted: boolean }>();
  (Notifications.getPermissionsAsync as jest.Mock).mockImplementationOnce(() => permission.promise);
  const old = scheduleCountdownReminders([{ ...dates[0], title: 'Ancienne date' }]);
  await scheduleCountdownReminders(dates);
  expect(scheduled.size).toBe(2);
  permission.resolve({ granted: true });
  await old;
  expect(scheduled.size).toBe(2);
  expect([...scheduled.values()].every((n) => n.content.body?.includes('Date fictive'))).toBe(true);
});

test('un ancien inventaire des notifications ne peut annuler les nouveaux rappels', async () => {
  const inventory = deferred<Scheduled[]>();
  const entered = deferred<void>();
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockImplementationOnce(() => {
    entered.resolve();
    return inventory.promise;
  });
  const old = scheduleCountdownReminders([{ ...dates[0], title: 'Ancienne date' }]);
  await entered.promise;
  await scheduleCountdownReminders(dates);
  inventory.resolve([...scheduled.values()]);
  await old;
  expect(scheduled.size).toBe(2);
  expect([...scheduled.values()].every((n) => n.content.body?.includes('Date fictive'))).toBe(true);
});

test('un résultat confirmé remplace uniquement les comptes à rebours, pas les autres notifications', async () => {
  scheduled.set('other', { identifier: 'other', content: { data: { kind: 'other' } } });
  scheduled.set('old', { identifier: 'old', content: { data: { kind: 'countdown' } } });
  await scheduleCountdownReminders(dates);
  expect(scheduled.has('other')).toBe(true);
  expect(scheduled.has('old')).toBe(false);
  expect(scheduled.size).toBe(3);
  const requests = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(([request]) => request);
  expect(requests).toHaveLength(2);
  expect(requests.map((r) => r.trigger.date.getDate())).toEqual([19, 20]);
  expect(requests.every((r) => r.trigger.date.getHours() === 9 && r.trigger.type === 'date')).toBe(true);
});

test('une liste vide confirmée retire les rappels de dates existants sans en créer', async () => {
  scheduled.set('old', { identifier: 'old', content: { data: { kind: 'countdown' } } });
  await scheduleCountdownReminders([]);
  expect(scheduled.size).toBe(0);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('sans permission, aucune notification n’est modifiée', async () => {
  scheduled.set('old', { identifier: 'old', content: { data: { kind: 'countdown' } } });
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
  await scheduleCountdownReminders(dates);
  expect(scheduled.has('old')).toBe(true);
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('une programmation déjà engagée est annulée si la session est nettoyée entre-temps', async () => {
  const created = deferred<string>();
  const entered = deferred<void>();
  (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementationOnce(() => { entered.resolve(); return created.promise; });
  const pending = scheduleCountdownReminders(dates);
  await entered.promise;
  await clearReminders();
  scheduled.set('late', { identifier: 'late', content: { data: { kind: 'countdown' } } });
  created.resolve('late');
  await pending;
  expect(scheduled.size).toBe(0);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('late');
});
