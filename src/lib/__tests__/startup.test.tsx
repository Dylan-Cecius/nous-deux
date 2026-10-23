import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform, Text } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import RootLayout from '@/app/_layout';
import { celebrate } from '@/components/celebrate';
import { useCouple } from '../couple-context';

jest.mock('@expo-google-fonts/dm-sans/400Regular', () => ({ DMSans_400Regular: 1 }));
jest.mock('@expo-google-fonts/dm-sans/500Medium', () => ({ DMSans_500Medium: 2 }));
jest.mock('@expo-google-fonts/dm-sans/700Bold', () => ({ DMSans_700Bold: 3 }));
jest.mock('@expo-google-fonts/fraunces/400Regular_Italic', () => ({ Fraunces_400Regular_Italic: 4 }));
jest.mock('@expo-google-fonts/fraunces/500Medium', () => ({ Fraunces_500Medium: 5 }));
jest.mock('@expo-google-fonts/fraunces/600SemiBold', () => ({ Fraunces_600SemiBold: 6 }));
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'status-bar' }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Stack = ({ children }: { children: import('react').ReactNode }) => React.createElement('stack', null, children);
  Stack.Protected = 'protected'; Stack.Screen = 'screen';
  return { Stack, ThemeProvider: 'theme-provider', DefaultTheme: {}, DarkTheme: {} };
});
jest.mock('@expo/vector-icons/Ionicons', () => 'icon');
jest.mock('../use-reduced-motion', () => ({ useReducedMotion: () => true }));
jest.mock('@/components/dialog', () => ({ DialogHost: 'dialog' }));
jest.mock('@/components/ui', () => ({ Button: 'button', Card: 'card', T: 'text' }));
jest.mock('@/constants/theme', () => ({ PrefsProvider: 'prefs', useTheme: () => ({}), Fonts: {} }));
jest.mock('../couple-context', () => ({ CoupleProvider: 'couple', useCouple: jest.fn() }));
jest.mock('../public-info', () => ({ getSupportContact: () => null }));
jest.mock('expo-splash-screen', () => {
  let reject!: (reason: Error) => void;
  const promise = new Promise((_, no) => { reject = no; });
  const catcher = jest.spyOn(promise, 'catch');
  return { preventAutoHideAsync: jest.fn(() => promise), hideAsync: jest.fn(), hold: { promise, reject, catcher } };
});

let root: ReactTestRenderer | undefined;
let warn: jest.SpyInstance;
const state = { loading: false, backend: null, restoreError: false, syncError: false, retrySession: jest.fn(), retrySync: jest.fn() };
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  (useCouple as jest.Mock).mockReturnValue(state);
  (useFonts as jest.Mock).mockReturnValue([true, null]);
  (SplashScreen.hideAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
});
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; warn.mockRestore(); jest.clearAllTimers(); jest.useRealTimers(); });
const mount = async () => act(async () => { root = create(<RootLayout />); });

test('le maintien initial du splash traite son rejet sans journaliser l’erreur brute', async () => {
  const hold = jest.requireMock('expo-splash-screen').hold;
  expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
  // Vérifier l’attachement avant de rejeter évite de créer un rejet global dans le test rouge.
  expect(hold.catcher).toHaveBeenCalledTimes(1);
  await act(async () => hold.reject(new Error('détail fictif à ne pas journaliser')));
  expect(warn).toHaveBeenCalledWith('Écran de lancement : maintien automatique indisponible.');
});

test('un échec de masquage est traité et ne retire pas la navigation prête', async () => {
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((_, no) => { reject = no; });
  const catcher = jest.spyOn(promise, 'catch');
  (SplashScreen.hideAsync as jest.Mock).mockReturnValue(promise);
  await mount();
  expect(catcher).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('détail natif fictif')));
  expect(warn).toHaveBeenCalledWith('Écran de lancement : masquage non confirmé.');
  expect(root!.root.findAllByType('stack' as never)).toHaveLength(1);
});

test.each(['session', 'polices'])('le splash n’est pas masqué pendant le chargement %s', async pending => {
  if (pending === 'session') (useCouple as jest.Mock).mockReturnValue({ ...state, loading: true });
  else (useFonts as jest.Mock).mockReturnValue([false, null]);
  await mount();
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  expect(root!.root.findAllByType('stack' as never)).toHaveLength(0);
  (useCouple as jest.Mock).mockReturnValue(state);
  (useFonts as jest.Mock).mockReturnValue([true, null]);
  await act(async () => root!.update(<RootLayout />));
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
});

test('une erreur de police autorise le démarrage avec le repli existant', async () => {
  (useFonts as jest.Mock).mockReturnValue([false, new Error('police fictive indisponible')]);
  await mount();
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  expect(root!.root.findAllByType('stack' as never)).toHaveLength(1);
});

test('une restauration refusée affiche toujours sa reprise après le splash', async () => {
  (useCouple as jest.Mock).mockReturnValue({ ...state, restoreError: true });
  await mount();
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  expect(root!.root.findAllByType('stack' as never)).toHaveLength(0);
  expect(root!.root.findByType('button' as never).props.onPress).toBe(state.retrySession);
});

const backend = { mode: 'local', coupleId: 'couple-fictif', userId: 'alice' };
const hasMessage = (text: string) => root!.root.findAllByType(Text).some(node => node.props.children === text);

test.each(['ios', 'web'] as const)('la déconnexion retire la célébration privée sur %s', async (platform) => {
  const previous = Platform.OS;
  Platform.OS = platform;
  try {
    (useCouple as jest.Mock).mockReturnValue({ ...state, backend });
    await mount();
    await act(async () => celebrate('hearts', 'Ancien partenaire fictif'));
    expect(hasMessage('Ancien partenaire fictif')).toBe(true);
    (useCouple as jest.Mock).mockReturnValue(state);
    await act(async () => root!.update(<RootLayout />));
    expect(hasMessage('Ancien partenaire fictif')).toBe(false);
    await act(async () => celebrate('hearts', 'Message hors session'));
    expect(hasMessage('Message hors session')).toBe(false);
  } finally {
    Platform.OS = previous;
  }
});

test.each([
  { userId: 'bob' }, { coupleId: 'autre-couple' }, { mode: 'cloud' },
])('changer de contexte %j retire le message précédent et accepte le nouveau', async (change) => {
  (useCouple as jest.Mock).mockReturnValue({ ...state, backend });
  await mount();
  await act(async () => celebrate('hearts', 'Ancien message fictif'));
  (useCouple as jest.Mock).mockReturnValue({ ...state, backend: { ...backend, ...change } });
  await act(async () => root!.update(<RootLayout />));
  expect(hasMessage('Ancien message fictif')).toBe(false);
  await act(async () => celebrate('hearts', 'Nouveau message fictif'));
  expect(hasMessage('Nouveau message fictif')).toBe(true);
});

test('une célébration disparaît quand l’espace devient inaccessible et ne revient pas à la reprise', async () => {
  (useCouple as jest.Mock).mockReturnValue({ ...state, backend });
  await mount();
  await act(async () => celebrate('hearts', 'Message privé fictif'));
  (useCouple as jest.Mock).mockReturnValue({ ...state, backend, syncError: true });
  await act(async () => root!.update(<RootLayout />));
  expect(hasMessage('Message privé fictif')).toBe(false);
  (useCouple as jest.Mock).mockReturnValue({ ...state, backend });
  await act(async () => root!.update(<RootLayout />));
  expect(hasMessage('Message privé fictif')).toBe(false);
});

test('un rendu ordinaire de la même session conserve le message jusqu’à sa fin normale', async () => {
  (useCouple as jest.Mock).mockReturnValue({ ...state, backend });
  await mount();
  await act(async () => celebrate('hearts', 'Message courant fictif'));
  await act(async () => root!.update(<RootLayout />));
  expect(hasMessage('Message courant fictif')).toBe(true);
  await act(async () => jest.advanceTimersByTime(2900));
  expect(hasMessage('Message courant fictif')).toBe(false);
});
