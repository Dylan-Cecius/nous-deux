import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NoteCard, PingCard } from '@/components/home/love-cards';
import { useCollectionState } from '../couple-context';
import { sendLoveNote } from '../assistant';
import { showDialog } from '@/components/dialog';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return {
    useCollection: () => state().items, useCollectionState: state,
    useSession: () => ({ backend: { userId: 'alice', mode: 'cloud' }, partner: { id: 'bob', name: 'Bob' }, nameOf: () => 'Bob', colorOf: () => '#000' }),
  };
});
jest.mock('../assistant', () => ({ sendLoveNote: jest.fn() }));
jest.mock('../haptics', () => ({ bump: jest.fn(), success: jest.fn() }));
jest.mock('@/components/celebrate', () => ({ celebrate: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), cardShadow: () => ({}), Fonts: {} }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return { confirmDelete: jest.fn(), ...Object.fromEntries(['Card', 'T', 'Button', 'IconButton', 'Row', 'Dot', 'Ionicons', 'Field'].map((name) => [
    name, (props: object) => React.createElement(name.toLowerCase(), props),
  ])) };
});

let root: ReactTestRenderer;
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const note = { id: 'note', kind: 'note', from: 'bob', text: 'Mot doux fictif', createdAt: 1 };
beforeEach(() => {
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  (sendLoveNote as jest.Mock).mockReset().mockResolvedValue(undefined);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });
const text = () => root.root.findAllByType('t' as never).map((node) => node.children.filter((child) => typeof child === 'string').join('')).join('\n');
const field = () => root.root.findByType('field' as never);

test.each(['loading', 'error'])('les mots doux en %s n’annoncent pas un historique vide', async (status) => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
  await act(async () => { root = create(<NoteCard />); });
  expect(text()).not.toContain('Pas encore de mot doux');
  expect(text()).toContain(status === 'loading' ? 'Chargement des mots doux' : 'Mots doux indisponibles');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer les mots doux' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
  expect(sendLoveNote).not.toHaveBeenCalled();
});

test('un brouillon survit à la panne et la reprise sans envoi automatique', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [note] });
  await act(async () => { root = create(<NoteCard />); });
  expect(text()).toContain('Mot doux fictif');
  await act(async () => { field().props.onChangeText('Brouillon fictif'); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true, items: [note] });
  await act(async () => { root.update(<NoteCard />); });
  expect(text()).not.toContain('Mot doux fictif');
  expect(field().props.value).toBe('Brouillon fictif');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [note] });
  await act(async () => { root.update(<NoteCard />); });
  expect(text()).toContain('Mot doux fictif');
  expect(field().props.value).toBe('Brouillon fictif');
  expect(sendLoveNote).not.toHaveBeenCalled();
});

test('un historique réellement vide garde son invitation à écrire', async () => {
  await act(async () => { root = create(<NoteCard />); });
  expect(text()).toContain('Pas encore de mot doux');
});

test.each(['loading', 'error'])('les cœurs reçus en %s ont un statut explicite', async (status) => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [status]: true });
  await act(async () => { root = create(<PingCard />); });
  expect(text()).toContain(status === 'loading' ? 'Chargement des cœurs reçus' : 'Historique des cœurs indisponible');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer les cœurs reçus' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  }
  expect(sendLoveNote).not.toHaveBeenCalled();
});

test('un appui clavier et un appui bouton simultanés n’envoient qu’un seul mot', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  (sendLoveNote as jest.Mock).mockReturnValue(pending);
  await act(async () => { root = create(<NoteCard />); });
  await act(async () => { field().props.onChangeText('Message fictif'); });
  let actions!: Promise<void>[];
  await act(async () => {
    actions = [field().props.onSubmitEditing(), root.root.findByProps({ label: 'Envoyer' }).props.onPress()];
  });
  const countWhilePending = (sendLoveNote as jest.Mock).mock.calls.length;
  expect(field().props.editable).toBe(false);
  await act(async () => { finish(); await Promise.all(actions); });
  expect(countWhilePending).toBe(1);
  expect(field().props.value).toBe('');
  expect(field().props.editable).toBe(true);
});

test('un échec d’envoi préserve la saisie et permet une reprise volontaire', async () => {
  (sendLoveNote as jest.Mock).mockRejectedValueOnce(new Error('Panne simulée')).mockResolvedValueOnce(undefined);
  await act(async () => { root = create(<NoteCard />); });
  await act(async () => { field().props.onChangeText('Texte conservé'); });
  await act(async () => { await field().props.onSubmitEditing(); });
  expect(field().props.value).toBe('Texte conservé');
  expect(field().props.editable).toBe(true);
  expect(showDialog).toHaveBeenCalledWith('Mot doux non envoyé', expect.any(String));
  await act(async () => { await root.root.findByProps({ label: 'Envoyer' }).props.onPress(); });
  expect(sendLoveNote).toHaveBeenCalledTimes(2);
  expect(field().props.value).toBe('');
});

test('une saisie vide ne déclenche aucun envoi, même depuis le clavier', async () => {
  await act(async () => { root = create(<NoteCard />); });
  await act(async () => { field().props.onChangeText('   '); });
  await act(async () => { await field().props.onSubmitEditing(); });
  expect(sendLoveNote).not.toHaveBeenCalled();
});

test('un cœur reçu n’est pas présenté comme actuel pendant une panne de lecture', async () => {
  const ping = { ...note, kind: 'ping' };
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [ping] });
  await act(async () => { root = create(<PingCard />); });
  expect(text()).toContain('Bob a pensé à toi');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true, items: [ping] });
  await act(async () => { root.update(<PingCard />); });
  expect(text()).not.toContain('Bob a pensé à toi');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [ping] });
  await act(async () => { root.update(<PingCard />); });
  expect(text()).toContain('Bob a pensé à toi');
  expect(sendLoveNote).not.toHaveBeenCalled();
});
