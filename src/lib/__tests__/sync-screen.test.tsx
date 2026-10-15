import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import RootLayout from '@/app/_layout';
import { useCouple } from '../couple-context';
import { getSupportContact } from '../public-info';

jest.mock('../couple-context', () => ({ CoupleProvider: ({ children }: { children: React.ReactNode }) => children, useCouple: jest.fn() }));
jest.mock('@/constants/theme', () => ({ PrefsProvider: ({ children }: { children: React.ReactNode }) => children, useTheme: () => ({ background: '#fff' }) }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-router', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  DarkTheme: {}, DefaultTheme: {},
  Stack: Object.assign(jest.fn(() => null), { Protected: () => null, Screen: () => null }),
}));
jest.mock('@/components/celebrate', () => ({ CelebrationLayer: () => null }));
jest.mock('@/components/dialog', () => ({ DialogHost: () => null }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return {
    Card: ({ children }: { children: React.ReactNode }) => children,
    T: (props: object) => React.createElement('text', props),
    Button: (props: object) => React.createElement('button', props),
  };
});

test('l’écran de synchronisation permet de réessayer sans relancer la connexion et affiche le contact', async () => {
  const retrySync = jest.fn();
  const retrySession = jest.fn();
  (useCouple as jest.Mock).mockReturnValue({ loading: false, backend: {}, restoreError: false, syncError: true, retrySync, retrySession });
  let root!: ReactTestRenderer;
  try {
    await act(async () => { root = create(<RootLayout />); });
    const retry = root.root.findByProps({ label: 'Réessayer' });
    await act(async () => { retry.props.onPress(); });
    expect(retrySync).toHaveBeenCalledTimes(1);
    expect(retrySession).not.toHaveBeenCalled();
    const texts = root.root.findAllByType('text' as never);
    expect(texts.some((text) => JSON.stringify(text.props.children).includes('Votre espace n’est pas accessible'))).toBe(true);
    expect(texts.some((text) => text.props.selectable && JSON.stringify(text.props.children).includes(getSupportContact()!.email))).toBe(true);
  } finally {
    if (root) await act(async () => root.unmount());
  }
});
