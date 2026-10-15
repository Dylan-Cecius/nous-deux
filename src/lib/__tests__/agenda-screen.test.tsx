import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Agenda from '@/app/(tabs)/agenda';
import Home from '@/app/(tabs)/index';
import { useCollectionState } from '../couple-context';
import { todayKey } from '../dates';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return {
    useCollection: (name: string) => state(name).items, useCollectionState: state,
    useSession: () => ({ backend: { userId: 'alice' }, members: [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }], colorOf: () => '#000', nameOf: () => 'Alice' }),
  };
});
jest.mock('@/components/assistant-context', () => ({ useAssistant: () => null }));
jest.mock('../assistant', () => ({ notifyPartner: jest.fn() }));
jest.mock('@/components/invitation-card', () => ({ InvitationCard: () => null }));
jest.mock('@/components/home/home-hero', () => ({ HomeHero: () => null }));
jest.mock('@/components/home/love-cards', () => ({ NoteCard: () => null, PingCard: () => null }));
jest.mock('@/components/home/memories-strip', () => ({ MemoriesStrip: () => null }));
jest.mock('@/components/home/question-card', () => ({ QuestionCard: () => null }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), cardShadow: () => ({}), Fonts: {}, Spacing: {} }));
jest.mock('@/components/pickers', () => ({ TimeField: () => null, DateField: () => null }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return { confirmDelete: jest.fn(), ...Object.fromEntries(['Screen', 'SectionTitle', 'Card', 'T', 'Button', 'Fab', 'Row', 'Dot', 'Ionicons', 'Sheet', 'Field', 'Chips', 'IconButton'].map((name) => [
    name, (props: object) => React.createElement(name.toLowerCase(), props),
  ])) };
});

let root: ReactTestRenderer;
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const event = { id: 'event', title: 'Horaire fictif', date: todayKey(), who: 'alice', start: '09:00', end: '12:00', kind: 'travail' };
beforeEach(() => { (useCollectionState as jest.Mock).mockReturnValue(ready); });
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });
const text = () => root.root.findAllByType('t' as never).map((node) => node.children.filter((child) => typeof child === 'string').join('')).join('\n');

test.each(['loading', 'error'])('un agenda en %s ne ressemble pas à une journée vide', async (status) => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
  await act(async () => { root = create(<Agenda />); });
  expect(text()).not.toContain('Aucun horaire ce jour-là');
  expect(text()).not.toContain('Libres ensemble');
  expect(text()).toContain(status === 'loading' ? 'Chargement de l’agenda' : 'Agenda indisponible');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer l’agenda' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
});

test.each(['loading', 'error'])('l’accueil en %s n’annonce pas une journée libre', async (status) => {
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'events' ? { ...ready, [status]: true } : ready);
  await act(async () => { root = create(<Home />); });
  expect(text()).not.toContain('Rien de prévu. Journée libre');
  expect(text()).toContain(status === 'loading' ? 'Chargement de l’agenda' : 'Agenda indisponible');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer l’agenda' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
});

test('un agenda confirmé vide garde son état vide normal', async () => {
  await act(async () => { root = create(<Agenda />); });
  expect(text()).toContain('Aucun horaire ce jour-là');
  expect(root.root.findByProps({ label: 'Ajouter un horaire' })).toBeTruthy();
});

test('une erreur masque les horaires et les disponibilités sans perdre la saisie ouverte', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [event] });
  await act(async () => { root = create(<Agenda />); });
  expect(text()).toContain('Libres ensemble');
  await act(async () => { root.root.findByProps({ label: 'Ajouter un horaire' }).props.onPress(); });
  await act(async () => { root.root.findByProps({ label: 'Titre' }).props.onChangeText('Brouillon fictif'); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [event], error: true });
  await act(async () => { root.update(<Agenda />); });
  expect(text()).not.toContain('Libres ensemble');
  expect(text()).not.toContain('Horaire fictif');
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe('Brouillon fictif');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [event] });
  await act(async () => { root.update(<Agenda />); });
  expect(text()).toContain('Libres ensemble');
  expect(root.root.findByProps({ label: 'Titre' }).props.value).toBe('Brouillon fictif');
});

test('le résumé du jour affiche à nouveau les événements après reprise', async () => {
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'events' ? { ...ready, error: true, items: [event] } : ready);
  await act(async () => { root = create(<Home />); });
  expect(text()).not.toContain('Horaire fictif');
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'events' ? { ...ready, items: [event] } : ready);
  await act(async () => { root.update(<Home />); });
  expect(text()).toContain('Horaire fictif');
  expect(text()).not.toContain('Agenda indisponible');
});

test.each(['loading', 'error'])('les dates à venir en %s ne proposent pas un faux démarrage à zéro', async (status) => {
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, [status]: true } : ready);
  await act(async () => { root = create(<Home />); });
  expect(text()).not.toContain('ajoutez les dates que vous attendez');
  expect(text()).toContain(status === 'loading' ? 'Chargement des dates' : 'Dates indisponibles');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer les dates' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
});

test('une date revient après reprise sans effacer la saisie de la nouvelle date', async () => {
  const date = { id: 'date', title: 'Sortie fictive', date: todayKey(), yearly: false };
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, items: [date] } : ready);
  await act(async () => { root = create(<Home />); });
  expect(text()).toContain('Sortie fictive');
  await act(async () => { root.root.findByProps({ title: 'À venir' }).props.onAction(); });
  await act(async () => { root.root.findByProps({ label: 'Quoi ?' }).props.onChangeText('Date en préparation'); });
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, error: true, items: [date] } : ready);
  await act(async () => { root.update(<Home />); });
  expect(text()).not.toContain('Sortie fictive');
  expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe('Date en préparation');
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? { ...ready, items: [date] } : ready);
  await act(async () => { root.update(<Home />); });
  expect(text()).toContain('Sortie fictive');
  expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe('Date en préparation');
});
