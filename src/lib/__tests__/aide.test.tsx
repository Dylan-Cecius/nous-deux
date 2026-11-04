import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import Aide from '@/app/aide';
import { showDialog } from '@/components/dialog';
import { getPublicSupportLinks, getSupportContact } from '../public-info';

let mockFocus: () => void;
let mockBlur: () => void;
jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() },
  useFocusEffect: (effect: () => (() => void)) => {
    jest.requireActual('react').useEffect(() => {
      mockFocus = () => { mockBlur = effect(); };
      mockFocus();
      return () => mockBlur();
    }, [effect]);
  },
}));
jest.mock('../public-info', () => ({ getPublicSupportLinks: jest.fn(), getSupportContact: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Button', 'Card', 'Screen', 'T'].map(name => [name, (props: object) => React.createElement(name.toLowerCase(), props)]));
});

const contact = { email: 'support@example.test', operator: 'Équipe fictive', mailto: 'mailto:support@example.test?subject=Test' };
const links = { support: 'https://example.test/', privacy: 'https://example.test/privacy', deletion: 'https://example.test/delete' };
const cases = [
  { label: 'Écrire à l’assistance', url: contact.mailto, title: 'Contacter l’assistance' },
  { label: 'Contacter l’assistance', url: links.support, title: 'Lien indisponible' },
  { label: 'Lire la politique de confidentialité', url: links.privacy, title: 'Lien indisponible' },
  { label: 'Demander la suppression depuis le Web', url: links.deletion, title: 'Lien indisponible' },
];
let root: ReactTestRenderer;
let openURL: jest.SpyInstance;
const action = (label: string) => root.root.findByProps({ label }).props.onPress;
beforeEach(async () => {
  jest.clearAllMocks();
  mockFocus = mockBlur = () => {};
  (getPublicSupportLinks as jest.Mock).mockReturnValue(links);
  (getSupportContact as jest.Mock).mockReturnValue(contact);
  (router.canGoBack as jest.Mock).mockReturnValue(true);
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await act(async () => { root = create(<Aide />); });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  openURL.mockRestore();
});

test.each(cases.flatMap(item => ['unmount', 'back', 'blur-return'].map(departure => ({ ...item, departure }))))('pas de dialogue $label après $departure', async ({ label, departure }) => {
  let reject!: (error: Error) => void;
  openURL.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => { pending = action(label)(); });
  await act(async () => {
    if (departure === 'unmount') root.unmount();
    else if (departure === 'back') root.root.findByType('screen' as never).props.onBack();
    else { mockBlur(); mockFocus(); }
  });
  await act(async () => { reject(new Error('erreur privée fictive')); await pending; });
  expect(showDialog).not.toHaveBeenCalled();
});

test.each(cases)('une ancienne action $label ne lance rien après départ', async ({ label }) => {
  const retained = action(label);
  await act(async () => root.root.findByType('screen' as never).props.onBack());
  await act(async () => retained());
  expect(openURL).not.toHaveBeenCalled();
});

test('les quatre liens partagent un verrou et permettent de réessayer après refus', async () => {
  let reject!: (error: Error) => void;
  openURL.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  const actions = cases.map(item => action(item.label));
  let pending!: Promise<void>;
  await act(async () => { pending = actions[0](); await actions[0](); for (const next of actions.slice(1)) await next(); });
  expect(openURL).toHaveBeenCalledTimes(1);
  for (const item of cases) expect(root.root.findByProps({ label: item.label }).props.disabled).toBe(true);
  await act(async () => { reject(new Error('échec fictif')); await pending; });
  for (const item of cases) expect(root.root.findByProps({ label: item.label }).props.disabled).toBe(false);
  await act(async () => action(cases[1].label)());
  expect(openURL).toHaveBeenCalledTimes(2);
});

test.each(cases)('le refus courant de $label affiche un repli sans détail de l’erreur', async ({ label, url, title }) => {
  openURL.mockRejectedValueOnce(new Error('private-token-fictitious'));
  await act(async () => action(label)());
  expect(openURL).toHaveBeenCalledWith(url);
  expect(showDialog).toHaveBeenCalledWith(title, expect.any(String));
  expect(JSON.stringify((showDialog as jest.Mock).mock.calls)).not.toContain('private-token');
});

test.each(cases)('une ouverture réussie $label ne prétend pas envoyer un message', async ({ label, url }) => {
  await act(async () => action(label)());
  expect(openURL).toHaveBeenCalledWith(url);
  expect(showDialog).not.toHaveBeenCalled();
});

test('les liens publics restent absents si leurs prérequis manquent', async () => {
  (getPublicSupportLinks as jest.Mock).mockReturnValue(null);
  await act(async () => root.update(<Aide />));
  for (const item of cases.slice(1)) expect(root.root.findAllByProps({ label: item.label })).toHaveLength(0);
  expect(root.root.findByProps({ label: cases[0].label })).toBeDefined();
});

test('un rendu ordinaire garde le repli courant et un retour permet une nouvelle action', async () => {
  let reject!: (error: Error) => void;
  openURL.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  let pending!: Promise<void>;
  await act(async () => { pending = action(cases[0].label)(); });
  await act(async () => root.update(<Aide />));
  await act(async () => { reject(new Error('refus fictif')); await pending; });
  expect(showDialog).toHaveBeenCalledTimes(1);
  await act(async () => { mockBlur(); mockFocus(); });
  openURL.mockRejectedValueOnce(new Error('nouveau refus fictif'));
  await act(async () => action(cases[0].label)());
  expect(showDialog).toHaveBeenCalledTimes(2);
  expect(openURL).toHaveBeenCalledTimes(2);
});

test('sans historique, le retour remplace la route par l’accueil', async () => {
  (router.canGoBack as jest.Mock).mockReturnValue(false);
  await act(async () => root.root.findByType('screen' as never).props.onBack());
  expect(router.replace).toHaveBeenCalledWith('/');
  expect(router.back).not.toHaveBeenCalled();
});
