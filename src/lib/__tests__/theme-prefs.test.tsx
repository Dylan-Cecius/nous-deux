import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PrefsProvider, usePrefs, useTheme } from '@/constants/theme';
import Nous from '@/app/(tabs)/nous';

jest.mock('../couple-context', () => ({
  useSession: () => ({ backend: { mode: 'local', userId: 'alice', coupleId: 'fictitious' }, members: [] }),
  useCollectionState: () => ({ items: [], loading: false, error: false }),
}));
jest.mock('../notifications', () => ({ pushSupported: false }));
jest.mock('../backend', () => ({ currentAccount: jest.fn() }));
jest.mock('../haptics', () => ({ tap: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/account', () => ({ AccountCard: () => null }));
jest.mock('@/components/invitation-card', () => ({ InvitationCard: () => null }));
jest.mock('@/components/celebrate', () => ({ celebrate: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'Avatar', 'ColorPicker', 'Field', 'Ionicons', 'Row'].map(name => [
    name, (props: object) => React.createElement(name.toLowerCase(), props),
  ]));
});

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  useColorScheme: { value: () => 'light' },
  Pressable: { value: 'pressable' },
}));
let root: ReactTestRenderer | undefined;
let prefs: ReturnType<typeof usePrefs>;
function Probe() {
  const current = usePrefs();
  useEffect(() => { prefs = current; }, [current]);
  const theme = useTheme();
  return <>{`${current.accent}:${theme.primary}`}</>;
}
async function mount() { await act(async () => { root = create(<PrefsProvider><Probe /></PrefsProvider>); }); }
beforeEach(() => {
  jest.resetAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; });

test.each(['constructor', '__proto__', 'toString', 'inconnu'])('une préférence stockée invalide %s garde le thème par défaut', async (value) => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(value);
  await mount();
  expect(root?.toJSON()).toBe('framboise:#C8385A');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('une préférence valide est restaurée', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('nuit');
  await mount();
  expect(root?.toJSON()).toBe('nuit:#3557A8');
});

test('les radios de thème reflètent le choix restauré puis le nouveau choix exclusif', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('nuit');
  await act(async () => { root = create(<PrefsProvider><Nous /></PrefsProvider>); });
  const radios = () => root!.root.findAllByType('pressable' as never).filter(node => node.props.accessibilityRole === 'radio');
  expect(radios().map(node => node.props.accessibilityLabel)).toEqual(['Framboise', 'Bleu nuit', 'Sauge', 'Terracotta']);
  expect(radios().map(node => node.props.accessibilityState.checked)).toEqual([false, true, false, false]);
  await act(async () => radios()[2].props.onPress());
  expect(radios().map(node => node.props.accessibilityState.checked)).toEqual([false, false, true, false]);
  expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('prefs:accent', 'sauge');
});

test('la lecture lente ne remplace pas un choix fait depuis le montage', async () => {
  let resolve!: (value: string) => void;
  (AsyncStorage.getItem as jest.Mock).mockReturnValue(new Promise<string>(r => { resolve = r; }));
  await mount();
  await act(async () => prefs.setAccent('sauge'));
  await act(async () => resolve('nuit'));
  expect(root?.toJSON()).toBe('sauge:#3F7A57');
});

test('une lecture refusée conserve un thème utilisable', async () => {
  (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('stockage fictif indisponible'));
  await mount();
  expect(root?.toJSON()).toBe('framboise:#C8385A');
});

test('une sauvegarde refusée garde le choix en mémoire sans rejet non traité', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('stockage fictif indisponible'));
  await mount();
  await act(async () => prefs.setAccent('sauge'));
  expect(root?.toJSON()).toBe('sauge:#3F7A57');
  await act(async () => prefs.setAccent('nuit'));
  expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('prefs:accent', 'nuit');
});

test('les sauvegardes sont ordonnées même si la première est lente', async () => {
  let finish!: () => void;
  (AsyncStorage.setItem as jest.Mock).mockReturnValueOnce(new Promise<void>(r => { finish = r; }));
  await mount();
  await act(async () => { prefs.setAccent('sauge'); prefs.setAccent('nuit'); });
  expect(root?.toJSON()).toBe('nuit:#3557A8');
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect((AsyncStorage.setItem as jest.Mock).mock.calls).toEqual([['prefs:accent', 'sauge'], ['prefs:accent', 'nuit']]);
});

test('un choix inconnu fourni à une ancienne action ne change ni le thème ni le stockage', async () => {
  await mount();
  await act(async () => prefs.setAccent('constructor'));
  expect(root?.toJSON()).toBe('framboise:#C8385A');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('une action retenue après démontage ne sauvegarde plus de préférence', async () => {
  await mount();
  const oldChoice = prefs.setAccent;
  await act(async () => root?.unmount());
  root = undefined;
  await act(async () => oldChoice('nuit'));
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
