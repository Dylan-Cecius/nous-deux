import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import RootLayout from '@/app/_layout';
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
jest.mock('@/components/celebrate', () => ({ CelebrationLayer: 'celebration' }));
jest.mock('@/components/dialog', () => ({ DialogHost: 'dialog' }));
jest.mock('@/components/ui', () => ({ Button: 'button', Card: 'card', T: 'text' }));
jest.mock('@/constants/theme', () => ({ PrefsProvider: 'prefs', useTheme: () => ({}) }));
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
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  (useCouple as jest.Mock).mockReturnValue(state);
  (useFonts as jest.Mock).mockReturnValue([true, null]);
  (SplashScreen.hideAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
});
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; warn.mockRestore(); });
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
