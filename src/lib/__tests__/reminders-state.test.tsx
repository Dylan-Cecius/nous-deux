import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BackgroundTasks } from '@/components/background-tasks';
import Nous from '@/app/(tabs)/nous';
import { useCollectionState, useSession } from '../couple-context';
import { ensurePermission, getPushToken, scheduleCountdownReminders } from '../notifications';
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
  expect(scheduleCountdownReminders).toHaveBeenLastCalledWith(dates, expect.any(Function));
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, error: true } : ready);
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(scheduleCountdownReminders).toHaveBeenCalledTimes(1);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  await act(async () => { root.update(<BackgroundTasks />); });
  expect(scheduleCountdownReminders).toHaveBeenCalledTimes(2);
  expect(scheduleCountdownReminders).toHaveBeenLastCalledWith([], expect.any(Function));
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
  expect(scheduleCountdownReminders).toHaveBeenCalledWith([], expect.any(Function));
  expect(showDialog).toHaveBeenCalledWith('Rappels activés', expect.any(String));
});

test.each(['unmount', 'backend', 'loading', 'error'])('le résultat de permission est ignoré après %s', async (kind) => {
  let finish!: (granted: boolean) => void;
  (ensurePermission as jest.Mock).mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }));
  await act(async () => { root = create(<Nous />); });
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
  if (kind === 'backend') (useSession as jest.Mock).mockReturnValue({ backend: { ...backend }, members: [] });
  else if (kind !== 'unmount') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [kind]: true });
  await act(async () => { if (kind === 'unmount') root.unmount(); else root.update(<Nous />); });
  await act(async () => { finish(true); await pending; });
  expect(scheduleCountdownReminders).not.toHaveBeenCalled();
  expect(backend.call).not.toHaveBeenCalled();
  expect((showDialog as jest.Mock).mock.calls.some(([title]) => title === 'Rappels activés')).toBe(false);
});

test('les dates fraîches sont utilisées après la réponse à la permission', async () => {
  let finish!: (granted: boolean) => void;
  (ensurePermission as jest.Mock).mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }));
  await act(async () => { root = create(<Nous />); });
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
  const dates = [{ id: 'fresh', title: 'Date fictive', date: '2999-01-01' }];
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: dates });
  await act(async () => root.update(<Nous />));
  await act(async () => { finish(true); await pending; });
  expect(scheduleCountdownReminders).toHaveBeenCalledWith(dates, expect.any(Function));
});

test.each(['schedule', 'token', 'registration'])('pas d’étape ni de succès tardif après le changement de contexte pendant %s', async (step) => {
  const cloud = { ...backend, mode: 'cloud' };
  (useSession as jest.Mock).mockReturnValue({ backend: cloud, members: [] });
  (getPushToken as jest.Mock).mockResolvedValue('fictitious-token');
  let finish!: () => void;
  const method = step === 'schedule' ? scheduleCountdownReminders : step === 'token' ? getPushToken : cloud.call;
  (method as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve(step === 'token' ? 'fictitious-token' : undefined); }));
  await act(async () => { root = create(<Nous />); });
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
  (useSession as jest.Mock).mockReturnValue({ backend: { ...cloud }, members: [] });
  await act(async () => root.update(<Nous />));
  await act(async () => { finish(); await pending; });
  if (step !== 'registration') expect(cloud.call).not.toHaveBeenCalled();
  if (step === 'schedule') expect(getPushToken).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});

test.each(['unmount', 'backend'])('une confirmation de déconnexion périmée après %s ne déconnecte pas', async (change) => {
  const signOut = jest.fn().mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue({ backend, members: [], signOut });
  await act(async () => { root = create(<Nous />); });
  await act(async () => root.root.findByProps({ label: 'Se déconnecter' }).props.onPress());
  const confirm = (showDialog as jest.Mock).mock.calls[0][2][1].onPress;
  if (change === 'backend') (useSession as jest.Mock).mockReturnValue({ backend: { ...backend }, members: [], signOut });
  await act(async () => { if (change === 'unmount') root.unmount(); else root.update(<Nous />); });
  await act(async () => { await confirm(); });
  expect(signOut).not.toHaveBeenCalled();
});

test('deux confirmations de déconnexion ne lancent qu’une sortie et l’échec permet une reprise', async () => {
  const signOut = jest.fn().mockRejectedValueOnce(new Error('Fictif')).mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue({ backend, members: [], signOut });
  await act(async () => { root = create(<Nous />); });
  await act(async () => root.root.findByProps({ label: 'Se déconnecter' }).props.onPress());
  const confirm = (showDialog as jest.Mock).mock.calls[0][2][1].onPress;
  await act(async () => { await Promise.all([confirm(), confirm()]); });
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(showDialog).toHaveBeenCalledWith('Déconnexion impossible', expect.any(String));
  await act(async () => { await confirm(); });
  expect(signOut).toHaveBeenCalledTimes(2);
});

test('la déconnexion invalide une permission de notifications encore en attente', async () => {
  let finish!: (granted: boolean) => void;
  (ensurePermission as jest.Mock).mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }));
  (useSession as jest.Mock).mockReturnValue({ backend, members: [], signOut: jest.fn().mockResolvedValue(undefined) });
  await act(async () => { root = create(<Nous />); });
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
  await act(async () => root.root.findByProps({ label: 'Se déconnecter' }).props.onPress());
  const confirm = (showDialog as jest.Mock).mock.calls[0][2][1].onPress;
  await act(async () => { await confirm(); finish(true); await pending; });
  expect(scheduleCountdownReminders).not.toHaveBeenCalled();
});

test('une ancienne déconnexion en échec ne bloque pas les commandes du nouveau contexte', async () => {
  let reject!: (error: Error) => void;
  const signOut = jest.fn(() => new Promise<void>((_, no) => { reject = no; }));
  (useSession as jest.Mock).mockReturnValue({ backend, members: [], signOut });
  await act(async () => { root = create(<Nous />); });
  await act(async () => root.root.findByProps({ label: 'Se déconnecter' }).props.onPress());
  const confirm = (showDialog as jest.Mock).mock.calls[0][2][1].onPress;
  let pending!: Promise<void>;
  await act(async () => { pending = confirm(); });
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend }, members: [], signOut: jest.fn().mockResolvedValue(undefined) });
  await act(async () => root.update(<Nous />));
  (showDialog as jest.Mock).mockClear();
  await act(async () => { reject(new Error('Ancien échec')); await pending; });
  expect(showDialog).not.toHaveBeenCalled();
  await act(async () => root.root.findByProps({ label: 'Se déconnecter' }).props.onPress());
  expect(showDialog).toHaveBeenCalledWith('Se déconnecter ?', expect.any(String), expect.any(Array));
});

test.each(['current', 'old'])('échec de permission %s : seule l’erreur courante est affichée', async (kind) => {
  let reject!: (error: Error) => void;
  (ensurePermission as jest.Mock).mockImplementationOnce(() => new Promise<boolean>((_, no) => { reject = no; }));
  await act(async () => { root = create(<Nous />); });
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
  if (kind === 'old') {
    (useSession as jest.Mock).mockReturnValue({ backend: { ...backend }, members: [] });
    await act(async () => root.update(<Nous />));
  }
  await act(async () => { reject(new Error('Permission fictive indisponible')); await pending; });
  if (kind === 'old') expect(showDialog).not.toHaveBeenCalled();
  else expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Permission fictive indisponible');
});

test.each(['unmount', 'backend', 'loading', 'error', 'dates'])('la tâche de fond invalide sa garde après %s, même si l’état initial revient', async (kind) => {
  await act(async () => { root = create(<BackgroundTasks />); });
  const guard = (scheduleCountdownReminders as jest.Mock).mock.calls[0][1];
  expect(typeof guard).toBe('function');
  expect(guard()).toBe(true);
  if (kind === 'backend') (useSession as jest.Mock).mockReturnValue({ backend: { ...backend }, members: [] });
  if (kind === 'dates') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [] });
  if (kind === 'loading' || kind === 'error') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [kind]: true });
  await act(async () => { if (kind === 'unmount') root.unmount(); else root.update(<BackgroundTasks />); });
  expect(guard()).toBe(false);
  (useSession as jest.Mock).mockReturnValue({ backend, members: [] });
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  if (kind !== 'unmount') await act(async () => root.update(<BackgroundTasks />));
  expect(guard()).toBe(false);
});

test.each(['unmount', 'backend', 'loading', 'error', 'dates', 'logout'])('l’activation transmet une garde invalidée après %s', async (kind) => {
  let finish!: () => void;
  (scheduleCountdownReminders as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  (useSession as jest.Mock).mockReturnValue({ backend, members: [], signOut: jest.fn().mockResolvedValue(undefined) });
  await act(async () => { root = create(<Nous />); });
  let pending!: Promise<void>;
  await act(async () => { pending = root.root.findByProps({ title: 'Notifications' }).props.onPress(); });
  const guard = (scheduleCountdownReminders as jest.Mock).mock.calls[0][1];
  expect(typeof guard).toBe('function');
  expect(guard()).toBe(true);
  if (kind === 'backend') (useSession as jest.Mock).mockReturnValue({ backend: { ...backend }, members: [] });
  if (kind === 'dates') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [] });
  if (kind === 'loading' || kind === 'error') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [kind]: true });
  if (kind === 'logout') {
    await act(async () => root.root.findByProps({ label: 'Se déconnecter' }).props.onPress());
    const confirm = (showDialog as jest.Mock).mock.calls[0][2][1].onPress;
    await act(async () => { await confirm(); });
    (showDialog as jest.Mock).mockClear();
  } else await act(async () => { if (kind === 'unmount') root.unmount(); else root.update(<Nous />); });
  expect(guard()).toBe(false);
  if (kind !== 'unmount' && kind !== 'logout') {
    (useSession as jest.Mock).mockReturnValue({ backend, members: [] });
    (useCollectionState as jest.Mock).mockReturnValue(ready);
    await act(async () => root.update(<Nous />));
    expect(guard()).toBe(false);
  }
  await act(async () => { finish(); await pending; });
  expect((showDialog as jest.Mock).mock.calls.some(([title]) => title === 'Rappels activés')).toBe(false);
});
