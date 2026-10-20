import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';
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
// Tous ces contrôles utilisent la branche photo. Le logo PNG absent n’est ni créé ni remplacé.
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
