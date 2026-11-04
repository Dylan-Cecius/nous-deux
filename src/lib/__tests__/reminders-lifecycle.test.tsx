import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as Notifications from 'expo-notifications';
import { BackgroundTasks } from '@/components/background-tasks';
import Nous from '@/app/(tabs)/nous';
import { useCollectionState, useSession } from '../couple-context';
import { showDialog } from '@/components/dialog';

// La couche applicative notifications reste réelle ; seuls les appels natifs sont doublés.
jest.mock('expo-constants', () => ({
  __esModule: true, default: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(), getPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(), SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('../couple-context', () => ({ useCollectionState: jest.fn(), useSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('@/components/celebrate', () => ({ celebrate: jest.fn() }));
jest.mock('@/components/account', () => ({ AccountCard: () => null }));
jest.mock('@/components/invitation-card', () => ({ InvitationCard: () => null }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('../backend', () => ({ currentAccount: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn(), tap: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), usePrefs: () => ({}), AccentThemes: {}, cardShadow: () => ({}) }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'Avatar', 'ColorPicker', 'Field', 'Ionicons', 'Row'].map((name) => [
    name, (props: object) => React.createElement(name.toLowerCase(), props),
  ]));
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};
let root: ReactTestRenderer;
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const dates = [{ id: 'fictitious', title: 'Date fictive', date: '2099-12-20', yearly: false, emoji: '' }];
const backend = { mode: 'local', coupleId: 'fictitious', userId: 'alice' };
const scheduled = new Set<string>();
beforeEach(() => {
  jest.clearAllMocks();
  scheduled.clear();
  (useSession as jest.Mock).mockReturnValue({ backend, members: [] });
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, items: dates } : ready);
  (Notifications.getPermissionsAsync as jest.Mock).mockReset().mockResolvedValue({ granted: true });
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockReset().mockResolvedValue([]);
  (Notifications.scheduleNotificationAsync as jest.Mock).mockReset().mockImplementation(async () => {
    const id = `id-${scheduled.size}`;
    scheduled.add(id);
    return id;
  });
  (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockReset().mockImplementation(async (id) => { scheduled.delete(id); });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

describe.each(['background', 'settings'])('%s, intégration avec le programmateur réel', (consumer) => {
  test.each([
    ['inventory', 'unmount'], ['inventory', 'error'], ['schedule', 'unmount'], ['schedule', 'error'],
  ])('attente native %s puis %s ne laisse aucun nouveau rappel', async (step, change) => {
    const entered = deferred<void>();
    const release = deferred<void>();
    const method = step === 'inventory' ? Notifications.getAllScheduledNotificationsAsync : Notifications.scheduleNotificationAsync;
    (method as jest.Mock).mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
      if (step === 'inventory') return [];
      scheduled.add('late');
      return 'late';
    });
    const view = consumer === 'background' ? <BackgroundTasks /> : <Nous />;
    await act(async () => { root = create(view); });
    let pending: Promise<void> | undefined;
    if (consumer === 'settings') await act(async () => { pending = root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
    await entered.promise;
    if (change === 'error') (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, items: dates, error: true } : ready);
    await act(async () => { if (change === 'unmount') root.unmount(); else root.update(consumer === 'background' ? <BackgroundTasks /> : <Nous />); });
    await act(async () => { release.resolve(); await pending; });
    expect(scheduled.size).toBe(0);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(step === 'schedule' ? 1 : 0);
    expect((showDialog as jest.Mock).mock.calls.some(([title]) => title === 'Rappels activés')).toBe(false);
  });
});

test('une permission révoquée entre activation et programmation ne produit pas un faux succès', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true }).mockResolvedValueOnce({ granted: false });
  await act(async () => { root = create(<Nous />); });
  await act(async () => { await root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(showDialog).toHaveBeenCalledWith('Activation interrompue', expect.any(String));
  expect((showDialog as jest.Mock).mock.calls.some(([title]) => title === 'Rappels activés')).toBe(false);
});
