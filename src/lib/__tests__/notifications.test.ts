import * as Notifications from 'expo-notifications';
import { clearReminders, scheduleCountdownReminders } from '../notifications';
import type { SpecialDate } from '../types';
import { fromKey, toKey } from '../dates';

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

test('une demande déjà périmée ne touche pas au système natif ni à une programmation courante', async () => {
  const permission = deferred<{ granted: boolean }>();
  (Notifications.getPermissionsAsync as jest.Mock).mockImplementationOnce(() => permission.promise);
  const current = scheduleCountdownReminders(dates);
  await scheduleCountdownReminders([], () => false);
  expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
  permission.resolve({ granted: true });
  await current;
  expect(scheduled.size).toBe(2);
});

test.each(['permission', 'inventory', 'cancellation'])('une invalidation pendant %s arrête la programmation', async (step) => {
  let active = true;
  const entered = deferred<void>();
  const release = deferred<void>();
  scheduled.set('old', { identifier: 'old', content: { data: { kind: 'countdown' } } });
  const method = step === 'permission' ? Notifications.getPermissionsAsync
    : step === 'inventory' ? Notifications.getAllScheduledNotificationsAsync : Notifications.cancelScheduledNotificationAsync;
  (method as jest.Mock).mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
    if (step === 'permission') return { granted: true };
    if (step === 'inventory') return [...scheduled.values()];
    scheduled.delete('old');
  });
  const pending = scheduleCountdownReminders(dates, () => active);
  await entered.promise;
  active = false;
  release.resolve();
  await pending;
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  if (step !== 'cancellation') {
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(scheduled.has('old')).toBe(true);
  }
});

test('une réponse native tardive nettoie tous les identifiants créés par sa demande, sans toucher aux autres', async () => {
  let active = true;
  const entered = deferred<void>();
  const release = deferred<void>();
  const createNotification = (Notifications.scheduleNotificationAsync as jest.Mock).getMockImplementation()!;
  (Notifications.scheduleNotificationAsync as jest.Mock)
    .mockImplementationOnce(createNotification)
    .mockImplementationOnce(async (request) => {
      entered.resolve();
      await release.promise;
      return createNotification(request);
    });
  const pending = scheduleCountdownReminders(dates, () => active);
  await entered.promise;
  expect(scheduled.size).toBe(1);
  active = false;
  scheduled.set('foreign', { identifier: 'foreign', content: { data: { kind: 'countdown' } } });
  release.resolve();
  await pending;
  expect([...scheduled.keys()]).toEqual(['foreign']);
});

test('un échec natif après invalidation nettoie aussi le premier rappel confirmé', async () => {
  let active = true;
  const createNotification = (Notifications.scheduleNotificationAsync as jest.Mock).getMockImplementation()!;
  (Notifications.scheduleNotificationAsync as jest.Mock)
    .mockImplementationOnce(createNotification)
    .mockImplementationOnce(async () => { active = false; throw new Error('Échec natif fictif'); });
  await expect(scheduleCountdownReminders(dates, () => active)).rejects.toThrow('Échec natif fictif');
  expect(scheduled.size).toBe(0);
});

test('un contexte toujours actif conserve les deux rappels', async () => {
  await scheduleCountdownReminders(dates, () => true);
  expect(scheduled.size).toBe(2);
});

test.each(['cancel', 'dismiss'])('un nettoyage %s en attente précède les nouveaux rappels', async (step) => {
  const entered = deferred<void>();
  const release = deferred<void>();
  const method = step === 'cancel' ? Notifications.cancelAllScheduledNotificationsAsync : Notifications.dismissAllNotificationsAsync;
  (method as jest.Mock).mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
    if (step === 'cancel') scheduled.clear();
  });
  const cleanup = clearReminders();
  await entered.promise;
  const next = scheduleCountdownReminders(dates);
  // Laisser avancer les promesses, sans temps natif ni attente chronométrée.
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const startedBeforeCleanup = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.length;
  release.resolve();
  await Promise.all([cleanup, next]);
  expect(startedBeforeCleanup).toBe(0);
  expect(scheduled.size).toBe(2);
});

test('deux nettoyages sont ordonnés et seule la programmation la plus récente reprend', async () => {
  const firstEntered = deferred<void>();
  const firstRelease = deferred<void>();
  const secondEntered = deferred<void>();
  const secondRelease = deferred<void>();
  (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock)
    .mockImplementationOnce(async () => { firstEntered.resolve(); await firstRelease.promise; scheduled.clear(); })
    .mockImplementationOnce(async () => { secondEntered.resolve(); await secondRelease.promise; scheduled.clear(); });
  const first = clearReminders();
  await firstEntered.promise;
  const obsolete = scheduleCountdownReminders([{ ...dates[0], title: 'Ancienne date' }]);
  const second = clearReminders();
  const current = scheduleCountdownReminders(dates);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const concurrentClears = (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mock.calls.length;
  firstRelease.resolve();
  await secondEntered.promise;
  secondRelease.resolve();
  await Promise.all([first, obsolete, second, current]);
  expect(concurrentClears).toBe(1);
  expect(scheduled.size).toBe(2);
  expect([...scheduled.values()].every((n) => n.content.body?.includes('Date fictive'))).toBe(true);
});

test('une erreur de nettoyage est visible et ne bloque pas toutes les reprises suivantes', async () => {
  (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockRejectedValueOnce(new Error('Annulation fictive impossible'));
  await expect(clearReminders()).rejects.toThrow('Annulation fictive impossible');
  await scheduleCountdownReminders(dates);
  expect(scheduled.size).toBe(2);
});

test('le retrait du centre de notifications est tenté même si l’annulation des rappels échoue', async () => {
  (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockRejectedValueOnce(new Error('Annulation fictive impossible'));
  await expect(clearReminders()).rejects.toThrow('Annulation fictive impossible');
  expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
});

test('une branche de nettoyage en échec ne libère pas la file pendant que l’autre est en attente', async () => {
  const entered = deferred<void>();
  const release = deferred<void>();
  (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockRejectedValueOnce(new Error('Annulation fictive impossible'));
  (Notifications.dismissAllNotificationsAsync as jest.Mock).mockImplementationOnce(async () => { entered.resolve(); await release.promise; });
  let completed = false;
  const cleanup = clearReminders().catch(() => { completed = true; });
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const attemptedDismissal = (Notifications.dismissAllNotificationsAsync as jest.Mock).mock.calls.length;
  const earlyCompletion = completed;
  const next = scheduleCountdownReminders(dates);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  const earlyCreation = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.length;
  release.resolve();
  await Promise.all([cleanup, next]);
  expect(attemptedDismissal).toBe(1);
  expect(earlyCompletion).toBe(false);
  expect(earlyCreation).toBe(0);
  expect(scheduled.size).toBe(2);
});

test('deux échecs de nettoyage restent signalés sans bloquer le nettoyage suivant', async () => {
  (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockRejectedValueOnce(new Error('Annulation fictive impossible'));
  (Notifications.dismissAllNotificationsAsync as jest.Mock).mockRejectedValueOnce(new Error('Retrait fictif impossible'));
  await expect(clearReminders()).rejects.toThrow('Annulation fictive impossible');
  await expect(clearReminders()).resolves.toBeUndefined();
  expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalledTimes(2);
});

test.each(['active', 'empty', 'inactive', 'denied'])('le résultat %s indique si la programmation est confirmée', async (kind) => {
  if (kind === 'denied') (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
  const result = await scheduleCountdownReminders(kind === 'empty' ? [] : dates, () => kind !== 'inactive');
  expect(result).toBe(kind === 'active' || kind === 'empty');
});

test('une programmation supplantée rapporte un arrêt, pas une réussite', async () => {
  const permission = deferred<{ granted: boolean }>();
  (Notifications.getPermissionsAsync as jest.Mock).mockImplementationOnce(() => permission.promise);
  const old = scheduleCountdownReminders(dates);
  const current = await scheduleCountdownReminders([]);
  permission.resolve({ granted: true });
  expect(await old).toBe(false);
  expect(current).toBe(true);
});

test.each([
  ['2026-02-28', ['2026-02-28', '2026-03-01']],
  ['2026-03-01', ['2026-03-01']],
])('rappels du 29 février au %s : pas de saut à l’année suivante', async (today, expected) => {
  jest.useFakeTimers();
  const now = fromKey(today);
  now.setHours(8);
  jest.setSystemTime(now);
  try {
    await scheduleCountdownReminders([{ ...dates[0], date: '2024-02-29', yearly: true }]);
    const triggers = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(([request]) => toKey(request.trigger.date));
    expect(triggers).toEqual(expected);
  } finally { jest.useRealTimers(); }
});

test('une première date annuelle future ne programme aucun rappel une année trop tôt', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 21, 8));
  try {
    await scheduleCountdownReminders([{ ...dates[0], date: '2028-11-30', yearly: true }]);
    const triggers = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(([request]) => toKey(request.trigger.date));
    expect(triggers).toEqual(['2028-11-29', '2028-11-30']);
  } finally { jest.useRealTimers(); }
});
