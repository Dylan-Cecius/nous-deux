import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccentThemes, MemberColors, PrefsProvider, useTheme } from '@/constants/theme';
import { Avatar, Button, Card, Chips, Fab, Field, T } from '@/components/ui';
import { foregroundOnColor } from '../color-contrast';
import Home from '@/app/(tabs)/index';
import { MemoryPhoto } from '@/components/memory-photo';
import { RestaurantRating } from '@/components/restaurant-rating';

jest.mock('../couple-context', () => ({
  useSession: () => ({ backend: { mode: 'local', coupleId: 'contrast', userId: 'alice' } }),
  useCollectionState: (name: string) => ({ loading: false, error: false, items: name === 'dates' ? [
    { id: 'today', title: 'Date fictive du jour', date: '2026-10-20', yearly: false },
    { id: 'tomorrow', title: 'Date fictive du lendemain', date: '2026-10-21', yearly: false },
  ] : [] }),
}));
jest.mock('../use-today', () => ({ useToday: () => '2026-10-20' }));
jest.mock('@/components/invitation-card', () => ({ InvitationCard: () => null }));
jest.mock('@/components/home/home-hero', () => ({ HomeHero: () => null }));
jest.mock('@/components/home/love-cards', () => ({ NoteCard: () => null, PingCard: () => null }));
jest.mock('@/components/home/memories-strip', () => ({ MemoriesStrip: () => null }));
jest.mock('@/components/home/question-card', () => ({ QuestionCard: () => null }));
jest.mock('@/components/pickers', () => ({ DateField: () => null }));

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { useColorScheme: { value: jest.fn() } }));
jest.mock('@expo/vector-icons/Ionicons', () => 'icon');
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'gradient' }));
jest.mock('expo-image', () => ({ Image: 'image' }));
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

test.each(['#fff', '#ABC', '#aBcDeF', '#000', '#123456', '#767676', '#777777'])('couleur opaque %s : texte au moins 4,5:1', (color) => {
  expect(contrast(foregroundOnColor(color), color)).toBeGreaterThanOrEqual(4.5);
});
test.each(['transparent', 'red', '#FFFF', '#FFFFFF80', '#12', '#GGGGGG', ''])('format non opaque ou inconnu %s : repli historique sans promesse de contraste', (color) => {
  expect(foregroundOnColor(color)).toBe('#FFFFFF');
});
test('tous les gris opaques conservent au moins 4,5:1 sans arrondi du ratio', () => {
  for (let channel = 0; channel < 256; channel++) {
    const color = '#' + channel.toString(16).padStart(2, '0').repeat(3);
    expect(contrast(foregroundOnColor(color), color)).toBeGreaterThanOrEqual(4.5);
  }
});

describe.each(MemberColors)('couleur de membre %s', (color) => {
  test('nom du choix sélectionné au moins 4,5:1', async () => {
    await act(async () => { root = create(<Chips value="a" onChange={() => {}} options={[{ value: 'a', label: 'Alice fictive', color, icon: 'person' }]} />); });
    const text = root.root.findAllByType(Text).find(node => node.props.children === 'Alice fictive')!;
    expect(contrast(StyleSheet.flatten(text.props.style).color, color)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(root.root.findByType('icon' as never).props.color, color)).toBeGreaterThanOrEqual(3);
  });
  test('initiale de petit avatar au moins 4,5:1', async () => {
    await act(async () => { root = create(<Avatar name="Alice fictive" color={color} size={32} />); });
    expect(contrast(StyleSheet.flatten(root.root.findByType(Text).props.style).color, color)).toBeGreaterThanOrEqual(4.5);
  });
});

test('le bouton dégradé garde texte et icône lisibles sur ses trois couleurs', async () => {
  await act(async () => { root = create(<Button label="Continuer" variant="sunset" icon="arrow-forward" onPress={() => {}} />); });
  const colors = root.root.findByType('gradient' as never).props.colors as string[];
  const text = root.root.findAllByType(Text).find(node => node.props.children === 'Continuer')!;
  const foreground = StyleSheet.flatten(text.props.style).color;
  const icon = root.root.findByType('icon' as never).props.color;
  for (const background of colors) {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(icon, background)).toBeGreaterThanOrEqual(3);
  }
});

test('le dégradé reste inchangé et ses couleurs sRGB intermédiaires conservent le contraste du texte', async () => {
  await act(async () => { root = create(<Button label="Continuer" variant="sunset" onPress={() => {}} />); });
  const colors = root.root.findByType('gradient' as never).props.colors as string[];
  expect(colors).toEqual(['#FFA36C', '#FF5A7A', '#E0479E']);
  const text = root.root.findAllByType(Text).find(node => node.props.children === 'Continuer')!;
  const foreground = StyleSheet.flatten(text.props.style).color;
  for (let segment = 0; segment < colors.length - 1; segment++) {
    const a = colors[segment].slice(1).match(/../g)!.map(x => parseInt(x, 16));
    const b = colors[segment + 1].slice(1).match(/../g)!.map(x => parseInt(x, 16));
    for (let percent = 0; percent <= 100; percent++) {
      const color = '#' + a.map((channel, i) => Math.round(channel + (b[i] - channel) * percent / 100).toString(16).padStart(2, '0')).join('');
      expect(contrast(foreground, color)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('le bouton dégradé garde le même premier plan pour son indicateur d’attente', async () => {
  let finish!: () => void;
  const action = () => new Promise<void>(resolve => { finish = resolve; });
  await act(async () => { root = create(<Button label="Continuer" variant="sunset" onPress={action} />); });
  const text = root.root.findAllByType(Text).find(node => node.props.children === 'Continuer')!;
  const foreground = StyleSheet.flatten(text.props.style).color;
  const press = root.root.findByProps({ accessibilityRole: 'button' }).props.onPress;
  let pending!: Promise<void>;
  await act(async () => { pending = press(); });
  expect(root.root.findByType(ActivityIndicator).props.color).toBe(foreground);
  await act(async () => { finish(); await pending; });
});

describe.each(['light', 'dark'])('contraste du thème %s', (scheme) => {
  test.each(Object.keys(AccentThemes))('%s : les cinq commandes de notation restent visibles, remplies ou vides', async accent => {
    (useColorScheme as jest.Mock).mockReturnValue(scheme);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(accent);
    await act(async () => { root = create(<PrefsProvider><Probe /><RestaurantRating value={3} size={32} onChange={() => {}} /></PrefsProvider>); });
    const icons = root.root.findAllByType('icon' as never);
    expect(icons.map(node => node.props.name)).toEqual(['heart', 'heart', 'heart', 'heart-outline', 'heart-outline']);
    for (const icon of icons) {
      expect(contrast(icon.props.color, palette.background)).toBeGreaterThanOrEqual(3);
      expect(contrast(icon.props.color, palette.card)).toBeGreaterThanOrEqual(3);
    }
  });
  test.each(Object.keys(AccentThemes))('%s : petit texte secondaire lisible sur les fonds clairs et doux', async accent => {
    (useColorScheme as jest.Mock).mockReturnValue(scheme);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(accent);
    await act(async () => { root = create(<PrefsProvider><Probe /><Card tone="soft"><T variant="small" muted>Information locale fictive</T></Card></PrefsProvider>); });
    const label = root.root.findAllByType(Text).find(node => node.props.children === 'Information locale fictive')!;
    const foreground = StyleSheet.flatten(label.props.style).color;
    for (const background of [palette.background, palette.card, palette.cardAlt, palette.primarySoft]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
  test.each(Object.keys(AccentThemes))('%s : chaque compte à rebours est contrasté sur sa carte', async accent => {
    (useColorScheme as jest.Mock).mockReturnValue(scheme);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(accent);
    await act(async () => { root = create(<PrefsProvider><Probe /><Home /></PrefsProvider>); });
    for (const label of ['Jour J', 'J-1']) {
      const node = root.root.findAllByType(Text).find(node => node.props.children === label)!;
      expect(contrast(StyleSheet.flatten(node.props.style).color, palette.card)).toBeGreaterThanOrEqual(4.5);
    }
  });
  test.each(Object.keys(AccentThemes))('%s : choix sélectionné lisible et icône contrastée', async (accent) => {
    (useColorScheme as jest.Mock).mockReturnValue(scheme);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(accent);
    await act(async () => { root = create(<PrefsProvider><Probe /><Chips value="a" onChange={() => {}} options={[{ value: 'a', label: 'Choix fictif', icon: 'heart' }]} /></PrefsProvider>); });
    const label = root.root.findAllByType(Text).find(node => node.props.children === 'Choix fictif')!;
    expect(contrast(StyleSheet.flatten(label.props.style).color, palette.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(root.root.findByType('icon' as never).props.color, palette.primary)).toBeGreaterThanOrEqual(3);
  });
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


describe.each(['light', 'dark'])('photo indisponible, thème %s', scheme => {
  test.each(Object.keys(AccentThemes))('%s : indication textuelle au moins 4,5:1', async accent => {
    (useColorScheme as jest.Mock).mockReturnValue(scheme);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(accent);
    await act(async () => { root = create(<PrefsProvider><Probe /><MemoryPhoto uri="fictitious://unavailable" style={{ width: 104, height: 132 }} /></PrefsProvider>); });
    await act(async () => { root.root.findByType('image' as never).props.onError({ error: 'fictitious' }); });
    const label = root.root.findAllByType(Text).find(node => node.props.children === 'Photo indisponible')!;
    expect(contrast(StyleSheet.flatten(label.props.style).color, palette.primarySoft)).toBeGreaterThanOrEqual(4.5);
  });
});


// Entry screen: base gradient, white glass surface, brightest peach overlay,
// then Field's translucent black fill. This checks composed colors, not alpha
// channels compared as though they were opaque.
const over = (foreground: string, background: string) => {
  const rgba = foreground.match(/^rgba\(([^)]+)\)$/)![1].split(',').map(Number);
  const bg = background.slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
  return '#' + bg.map((channel, index) => Math.round(rgba[index] * rgba[3] + channel * (1 - rgba[3])).toString(16).padStart(2, '0')).join('');
};

test.each(['#4A2238', '#2A1420', '#1A0B14'])('exemple de saisie sombre lisible sur le fond d’entrée %s', async background => {
  await act(async () => { root = create(<Field dark label="Ton prénom" placeholder="Ex. Camille" />); });
  const input = root.root.findByType(TextInput);
  const glass = over('rgba(255,170,110,0.26)', over('rgba(255,255,255,0.04)', background));
  const fill = over(StyleSheet.flatten(input.props.style).backgroundColor, glass);
  const placeholder = over(input.props.placeholderTextColor, fill);
  expect(contrast(placeholder, fill)).toBeGreaterThanOrEqual(4.5);
});
