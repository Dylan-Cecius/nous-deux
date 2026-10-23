import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, StyleSheet, Text } from 'react-native';
import { HomeHero } from '@/components/home/home-hero';
import { useSession } from '../couple-context';
import { useToday } from '../use-today';

jest.mock('../couple-context', () => ({ useSession: jest.fn() }));
jest.mock('../use-today', () => ({ useToday: jest.fn() }));
jest.mock('@/components/assistant-context', () => ({ useAssistant: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'gradient' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/constants/theme', () => ({ Fonts: {} }));
jest.mock('@/components/framed-photo', () => ({ FramedPhoto: 'photo' }));
jest.mock('@/components/home/counter-card', () => ({ CounterSheet: 'sheet' }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Ionicons', 'Row', 'T'].map(name => [name, (props: object) => React.createElement(name.toLowerCase(), props)]));
});
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { Pressable: { value: 'pressable' } }));

let root: ReactTestRenderer;
// Photos fictives ; le logo de la branche sans espace utilise la ressource originale du dépôt.
const session = { couple: { since: '2026-01-01', photoUrl: 'fictitious://couple' }, me: { name: 'Alice' }, partner: { name: 'Bob' } };
const counter = () => root.root.findByType(Pressable);
beforeEach(() => {
  jest.clearAllMocks();
  (useSession as jest.Mock).mockReturnValue(session);
  (useToday as jest.Mock).mockReturnValue('2026-01-01');
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test.each([
  ['2026-01-01', '0 jour ensemble', '100 jours dans 100 jours'],
  ['2026-01-02', '1 jour ensemble', '100 jours dans 99 jours'],
  ['2026-04-10', '99 jours ensemble', '100 jours dans 1 jour'],
  ['2028-09-28', '1 001 jours ensemble', '1 500 jours dans 499 jours'],
])('le compteur annonce ses données visibles au %s', async (today, count, milestone) => {
  (useToday as jest.Mock).mockReturnValue(today);
  await act(async () => { root = create(<HomeHero />); });
  const label = counter().props.accessibilityLabel;
  expect(label).toContain(count);
  expect(label).toContain('1 janvier 2026');
  expect(label).toContain(milestone);
  expect(counter().props.accessibilityHint).toContain('date de rencontre');
  expect(counter().props.accessibilityRole).toBe('button');
});

test('sans date le compteur décrit ce qui reste à renseigner', async () => {
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { photoUrl: session.couple.photoUrl } });
  await act(async () => { root = create(<HomeHero />); });
  expect(counter().props.accessibilityLabel).toContain('Date de rencontre non renseignée');
  expect(counter().props.accessibilityLabel).not.toContain('jours');
  expect(counter().props.accessibilityHint).toContain('date de rencontre');
});

test('le résumé accessible suit le changement de journée', async () => {
  await act(async () => { root = create(<HomeHero />); });
  (useToday as jest.Mock).mockReturnValue('2026-01-02');
  await act(async () => root.update(<HomeHero />));
  expect(counter().props.accessibilityLabel).toContain('1 jour ensemble');
  expect(counter().props.accessibilityLabel).not.toContain('0 jour ensemble');
});

test('activer le compteur ouvre la fiche et sa fermeture revient au bandeau', async () => {
  await act(async () => { root = create(<HomeHero />); });
  await act(async () => counter().props.onPress());
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(1);
  await act(async () => root.root.findByType('sheet' as never).props.onClose());
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});


test('une date de rencontre future ne présente ni compteur négatif ni cap trompeur', async () => {
  (useToday as jest.Mock).mockReturnValue('2025-12-31');
  await act(async () => { root = create(<HomeHero />); });
  const label = counter().props.accessibilityLabel;
  expect(label).toContain('Date de rencontre à vérifier');
  expect(label).toContain('1 janvier 2026');
  expect(label).not.toContain('-1');
  expect(label).not.toContain('Cap des');
  expect(root.root.findAllByType('t' as never).map(node => node.props.children).join(' ')).toContain('date de votre téléphone');
  await act(async () => counter().props.onPress());
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(1);
});

test('le compteur reprend quand la journée atteint la date enregistrée sans fermer la fiche', async () => {
  (useToday as jest.Mock).mockReturnValue('2025-12-31');
  await act(async () => { root = create(<HomeHero />); });
  expect(counter().props.accessibilityLabel).toContain('Date de rencontre à vérifier');
  await act(async () => counter().props.onPress());
  (useToday as jest.Mock).mockReturnValue('2026-01-01');
  await act(async () => root.update(<HomeHero />));
  expect(counter().props.accessibilityLabel).toContain('0 jour ensemble');
  expect(counter().props.accessibilityLabel).not.toContain('à vérifier');
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(1);
});


test('le bandeau sans photo charge le logo original avec le même alias que TypeScript', async () => {
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: { since: '2026-01-01' } });
  await act(async () => { root = create(<HomeHero />); });
  expect(counter().props.accessibilityLabel).toContain('0 jour ensemble');
});

test('un espace indisponible ne prétend pas que la date de rencontre est absente', async () => {
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: null });
  await act(async () => { root = create(<HomeHero />); });
  expect(counter().props.accessibilityLabel).toContain('Votre histoire est indisponible');
  expect(counter().props.accessibilityLabel).not.toContain('non renseignée');
  const visible = root.root.findAllByType('t' as never).map(node => node.props.children).join(' ');
  expect(visible).toContain('synchronisation');
  expect(visible).not.toContain('Ajoutez votre date');
});

test('le bandeau retrouve le compteur après reprise de l’espace sans ouvrir de fiche', async () => {
  (useSession as jest.Mock).mockReturnValue({ ...session, couple: null });
  await act(async () => { root = create(<HomeHero />); });
  expect(counter().props.accessibilityLabel).toContain('indisponible');
  (useSession as jest.Mock).mockReturnValue(session);
  await act(async () => root.update(<HomeHero />));
  expect(counter().props.accessibilityLabel).toContain('0 jour ensemble');
  expect(counter().props.accessibilityLabel).not.toContain('indisponible');
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});

// Worst-case bright photo. Check the rendered colors, not a hardcoded opacity.
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const composite = (color: string, background: number[]) => {
  if (color.startsWith('#')) return rgb(color);
  const [r, g, b, alpha] = color.match(/rgba\(([^)]+)\)/)![1].split(',').map(Number);
  return [r, g, b].map((channel, i) => channel * alpha + background[i] * (1 - alpha));
};
const luminance = (channels: number[]) => channels.map(channel => channel / 255)
  .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);

test('la photo la plus claire conserve un contraste de texte de 4,5:1 sur le bandeau', async () => {
  await act(async () => { root = create(<HomeHero />); });
  const overlay = root.root.findAllByType('gradient' as never)
    .find(node => node.props.colors.every((color: string) => color.startsWith('rgba(')))!;
  const colors = [
    ...root.root.findAllByType(Text).map(node => StyleSheet.flatten(node.props.style).color as string),
    ...root.root.findAllByType('t' as never).map(node => node.props.color as string),
  ];
  const stops = overlay.props.colors.map((color: string) => composite(color, [255, 255, 255])) as number[][];
  for (let i = 1; i < stops.length; i++) {
    for (let step = 0; step <= 20; step++) {
      const background = stops[i - 1].map((channel, j) => channel + (stops[i][j] - channel) * step / 20);
      for (const color of colors) {
        const foreground = composite(color, background);
        const [dark, light] = [luminance(background), luminance(foreground)].sort((a, b) => a - b);
        expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
