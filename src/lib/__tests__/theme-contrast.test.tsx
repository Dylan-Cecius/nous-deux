import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccentThemes, PrefsProvider, useTheme } from '@/constants/theme';
import { Fab } from '@/components/ui';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { useColorScheme: { value: jest.fn() } }));
jest.mock('@expo/vector-icons/Ionicons', () => 'icon');
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'gradient' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/components/assistant-context', () => ({ useAssistant: () => null }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('../haptics', () => ({ tap: jest.fn() }));

// Relative sRGB luminance and unrounded WCAG contrast of opaque theme colors.
const luminance = (hex: string) => {
  const digits = hex.length === 4 ? hex.slice(1).split('').map(x => x + x).join('') : hex.slice(1);
  const channels = digits.match(/../g)!.map(x => parseInt(x, 16) / 255)
    .map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
let root: ReactTestRenderer;
let palette: ReturnType<typeof useTheme>;
function Probe() { const t = useTheme(); useEffect(() => { palette = t; }, [t]); return null; }
beforeEach(() => { jest.clearAllMocks(); (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined); });
afterEach(async () => { if (root) await act(async () => root.unmount()); });

describe.each(['light', 'dark'])('contraste du thème %s', (scheme) => {
  test.each(Object.keys(AccentThemes))('%s : texte principal au moins 4,5:1 sur son bouton', async (accent) => {
    (useColorScheme as jest.Mock).mockReturnValue(scheme);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(accent);
    await act(async () => { root = create(<PrefsProvider><Probe /></PrefsProvider>); });
    expect(contrast(palette.onPrimary, palette.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

test('le bouton flottant reprend la couleur contrastée du thème, y compris pendant l’attente', async () => {
  (useColorScheme as jest.Mock).mockReturnValue('dark');
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('sauge');
  let finish!: () => void;
  const action = () => new Promise<void>(r => { finish = r; });
  await act(async () => { root = create(<PrefsProvider><Probe /><Fab onPress={action} /></PrefsProvider>); });
  const icon = root.root.findByType('icon' as never);
  expect(contrast(icon.props.color, palette.primary)).toBeGreaterThanOrEqual(3);
  const button = root.root.findByProps({ accessibilityLabel: 'Ajouter' });
  let pending!: Promise<void>;
  await act(async () => { pending = button.props.onPress(); });
  expect(root.root.findByType(ActivityIndicator).props.color).toBe(palette.onPrimary);
  await act(async () => { finish(); await pending; });
});
