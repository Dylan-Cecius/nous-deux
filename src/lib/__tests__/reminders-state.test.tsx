import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BackgroundTasks } from '@/components/background-tasks';
import Nous from '@/app/(tabs)/nous';
import { useCollectionState, useSession } from '../couple-context';
import { ensurePermission, scheduleCountdownReminders } from '../notifications';
import { showDialog } from '@/components/dialog';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return { useCollection: (name: string) => state(name).items, useCollectionState: state, useSession: jest.fn() };
});
jest.mock('../notifications', () => ({ ensurePermission: jest.fn(), scheduleCountdownReminders: jest.fn(() => Promise.resolve()), getPushToken: jest.fn(), pushSupported: false }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn() }));
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

let root: ReactTestRenderer;
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const backend = { mode: 'local', userId: 'alice', coupleId: 'test', call: jest.fn() };
beforeEach(() => {
  (useSession as jest.Mock).mockReturnValue({ backend, members: [] });
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  (ensurePermission as jest.Mock).mockResolvedValue(true);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });

test.each(['loading', 'error'])('les dates en %s ne remplacent pas les rappels en arrière-plan', async (status) => {
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, [status]: true } : ready);
  await act(async () => { root = create(<BackgroundTasks />); });
  expect(scheduleCountdownReminders).not.toHaveBeenCalled();
});

test('un résultat confirmé, y compris vide, renouvelle les rappels mais pas une erreur ultérieure', async () => {
  const dates = [{ id: 'test', title: 'Date fictive', date: '2026-12-01' }];
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, items: dates } : ready);
  await act(async () => { root = create(<BackgroundTasks />); });
  expect(scheduleCountdownReminders).toHaveBeenLastCalledWith(dates);
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, error: true } : ready);
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(scheduleCountdownReminders).toHaveBeenCalledTimes(1);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(scheduleCountdownReminders).toHaveBeenCalledTimes(2);
  expect(scheduleCountdownReminders).toHaveBeenLastCalledWith([]);
});

test.each(['loading', 'error'])('Nous distingue les résumés en %s d’un espace vide', async (status) => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
  await act(async () => { root = create(<Nous />); });
  const text = JSON.stringify(root.toJSON());
  expect(text).not.toContain('Votre album photo à deux');
  expect(text).not.toContain('Partagez les frais à moitié');
  expect(text).toContain(status === 'loading' ? 'Chargement des souvenirs' : 'Souvenirs indisponibles');
});

test('les reprises de Nous ciblent seulement la collection choisie', async () => {
  const retries = { memories: jest.fn(), expenses: jest.fn(), dates: jest.fn() };
  (useCollectionState as jest.Mock).mockImplementation((name: keyof typeof retries) => ({ ...ready, error: true, retry: retries[name] }));
  await act(async () => { root = create(<Nous />); });
  await act(async () => { root.root.findByProps({ label: 'Réessayer les souvenirs' }).props.onPress(); });
  expect(retries.memories).toHaveBeenCalledTimes(1);
  expect(retries.expenses).not.toHaveBeenCalled();
  expect(retries.dates).not.toHaveBeenCalled();
});

test.each(['loading', 'error'])('activer les notifications avec des dates en %s ne touche pas aux rappels', async (status) => {
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, [status]: true } : ready);
  await act(async () => { root = create(<Nous />); });
  await act(async () => { await root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
  expect(ensurePermission).not.toHaveBeenCalled();
  expect(scheduleCountdownReminders).not.toHaveBeenCalled();
  expect(backend.call).not.toHaveBeenCalled();
  expect(showDialog).toHaveBeenCalledWith(status === 'loading' ? 'Chargement des dates' : 'Dates indisponibles', expect.any(String));
});

test('les dates confirmées permettent encore d’activer les rappels locaux', async () => {
  await act(async () => { root = create(<Nous />); });
  await act(async () => { await root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
  expect(ensurePermission).toHaveBeenCalledTimes(1);
  expect(scheduleCountdownReminders).toHaveBeenCalledWith([]);
  expect(showDialog).toHaveBeenCalledWith('Rappels activés', expect.any(String));
});
