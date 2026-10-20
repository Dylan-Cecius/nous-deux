import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NoteCard, PingCard } from '@/components/home/love-cards';
import { useCollectionState, useSession } from '../couple-context';
import { sendLoveNote } from '../assistant';
import { showDialog } from '@/components/dialog';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return {
    useCollection: () => state().items, useCollectionState: state,
    useSession: jest.fn(),
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
  (useSession as jest.Mock).mockReturnValue({ backend: { userId: 'alice', mode: 'cloud', coupleId: 'couple-a' }, partner: { id: 'bob', name: 'Bob' }, nameOf: () => 'Bob', colorOf: () => '#000' });
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
  expect(showDialog).toHaveBeenCalledWith('Enregistrement non confirmé', expect.any(String));
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


test.each(['userId', 'coupleId', 'mode'])('le brouillon reste privé après changement de %s', async (key) => {
  await act(async () => { root = create(<NoteCard />); });
  await act(async () => { field().props.onChangeText('Brouillon privé fictif'); });
  const oldSubmit = field().props.onSubmitEditing;
  const session = (useSession as jest.Mock).mock.results.at(-1)!.value;
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...session.backend, [key]: key === 'mode' ? 'local' : 'autre' } });
  await act(async () => { root.update(<NoteCard />); });
  expect(field().props.value).toBe('');
  await act(async () => { await oldSubmit(); });
  expect(sendLoveNote).not.toHaveBeenCalled();
});

test('un ancien bouton utilise le brouillon actuel, pas une ancienne saisie', async () => {
  await act(async () => { root = create(<NoteCard />); });
  await act(async () => { field().props.onChangeText('Ancien texte'); });
  const submit = field().props.onSubmitEditing;
  await act(async () => { field().props.onChangeText('Nouveau texte'); });
  await act(async () => { await submit(); });
  expect((sendLoveNote as jest.Mock).mock.calls[0][1]).toBe('Nouveau texte');
});

test('un ancien bouton ne peut pas renvoyer un mot déjà confirmé', async () => {
  await act(async () => { root = create(<NoteCard />); });
  await act(async () => { field().props.onChangeText('Texte fictif'); });
  const submit = field().props.onSubmitEditing;
  await act(async () => { await submit(); });
  await act(async () => { await submit(); });
  expect(sendLoveNote).toHaveBeenCalledTimes(1);
});

test.each(['success', 'failure'])('une issue tardive %s reste silencieuse après départ', async (outcome) => {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  (sendLoveNote as jest.Mock).mockReturnValue(new Promise<void>((yes, no) => { resolve = yes; reject = no; }));
  await act(async () => { root = create(<NoteCard />); });
  await act(async () => { field().props.onChangeText('Texte fictif'); });
  let pending!: Promise<void>;
  await act(async () => { pending = field().props.onSubmitEditing(); });
  await act(async () => { root.unmount(); });
  await act(async () => { if (outcome === 'success') resolve(); else reject(new Error('Panne')); await pending; });
  expect(showDialog).not.toHaveBeenCalled();
  expect(jest.requireMock('@/components/celebrate').celebrate).not.toHaveBeenCalled();
});

test('remplacer le backend invalide les anciennes actions même avec les mêmes identifiants', async () => {
  await act(async () => { root = create(<NoteCard />); });
  await act(async () => { field().props.onChangeText('Texte fictif'); });
  const oldSubmit = field().props.onSubmitEditing;
  const session = (useSession as jest.Mock).mock.results.at(-1)!.value;
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...session.backend } });
  await act(async () => { root.update(<NoteCard />); });
  await act(async () => { await oldSubmit(); });
  expect(sendLoveNote).not.toHaveBeenCalled();
  expect(field().props.value).toBe('Texte fictif');
  await act(async () => { await field().props.onSubmitEditing(); });
  expect(sendLoveNote).toHaveBeenCalledTimes(1);
});

describe('transport des mots doux avec backend simulé', () => {
  const actualSend = jest.requireActual<typeof import('../assistant')>('../assistant').sendLoveNote;
  const backend = () => ({ mode: 'cloud', userId: 'alice', add: jest.fn().mockResolvedValue('note-id'), call: jest.fn().mockResolvedValue(undefined) });

  test('une action invalidée ne démarre aucune écriture', async () => {
    const fake = backend();
    await actualSend({ backend: fake as never }, 'Texte fictif', 'note', () => false);
    expect(fake.add).not.toHaveBeenCalled();
    expect(fake.call).not.toHaveBeenCalled();
  });

  test('une session quittée pendant l’écriture ne notifie plus le partenaire', async () => {
    const fake = backend();
    let finish!: () => void;
    fake.add.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    let current = true;
    const pending = actualSend({ backend: fake as never }, 'Texte fictif', 'note', () => current);
    expect(fake.add).toHaveBeenCalledTimes(1);
    current = false;
    finish();
    await pending;
    expect(fake.call).not.toHaveBeenCalled();
  });

  test('une session valide écrit puis notifie sans contenu intime', async () => {
    const fake = backend();
    await actualSend({ backend: fake as never }, 'Texte fictif', 'note');
    expect(fake.add).toHaveBeenCalledWith('notes', expect.objectContaining({ text: 'Texte fictif', from: 'alice', kind: 'note' }));
    expect(fake.call).toHaveBeenCalledWith('notifyPartner', { kind: 'note' });
  });

  test('une panne de notification ne transforme pas une écriture confirmée en échec', async () => {
    const fake = backend();
    fake.call.mockRejectedValue(new Error('Panne fictive'));
    await expect(actualSend({ backend: fake as never }, 'Texte fictif')).resolves.toBeUndefined();
    expect(fake.add).toHaveBeenCalledTimes(1);
  });

  test('une écriture échouée ne notifie pas', async () => {
    const fake = backend();
    fake.add.mockRejectedValue(new Error('Échec fictif'));
    await expect(actualSend({ backend: fake as never }, 'Texte fictif')).rejects.toThrow('Échec fictif');
    expect(fake.call).not.toHaveBeenCalled();
  });
});

const heart = () => root.root.findByProps({ accessibilityLabel: 'Envoyer « je pense à toi »' });

test('un cœur ne part pas sans partenaire cloud même via une action conservée', async () => {
  const session = (useSession as jest.Mock)();
  (useSession as jest.Mock).mockReturnValue({ ...session, partner: undefined });
  await act(async () => { root = create(<PingCard />); });
  await act(async () => { await heart().props.onPress(); });
  expect(sendLoveNote).not.toHaveBeenCalled();
});

test('un ancien bouton cœur ne contourne pas le délai après envoi', async () => {
  await act(async () => { root = create(<PingCard />); });
  const press = heart().props.onPress;
  await act(async () => { await press(); });
  await act(async () => { await press(); });
  expect(sendLoveNote).toHaveBeenCalledTimes(1);
});

test.each(['partner', 'backend'])('le changement de %s invalide le bouton cœur conservé', async (change) => {
  await act(async () => { root = create(<PingCard />); });
  const press = heart().props.onPress;
  const session = (useSession as jest.Mock)();
  (useSession as jest.Mock).mockReturnValue({ ...session, ...(change === 'backend' ? { backend: { ...session.backend } } : { partner: undefined }) });
  await act(async () => { root.update(<PingCard />); });
  await act(async () => { await press(); });
  expect(sendLoveNote).not.toHaveBeenCalled();
});

test('un cœur en attente ne célèbre pas dans le compte suivant', async () => {
  let finish!: () => void;
  (sendLoveNote as jest.Mock).mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  await act(async () => { root = create(<PingCard />); });
  let pending!: Promise<void>;
  await act(async () => { pending = heart().props.onPress(); });
  const session = (useSession as jest.Mock)();
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...session.backend, userId: 'charlie' } });
  await act(async () => { root.update(<PingCard />); });
  await act(async () => { finish(); await pending; });
  expect(text()).not.toContain('Cœur envoyé');
  expect(jest.requireMock('@/components/celebrate').celebrate).not.toHaveBeenCalled();
});

test('deux appuis successifs avant rafraîchissement respectent le délai cœur', async () => {
  await act(async () => { root = create(<PingCard />); });
  const press = heart().props.onPress;
  await act(async () => { await press(); await press(); });
  expect(sendLoveNote).toHaveBeenCalledTimes(1);
});

test('un échec cœur d’un ancien backend reste silencieux', async () => {
  let reject!: (error: Error) => void;
  (sendLoveNote as jest.Mock).mockReturnValue(new Promise<void>((_, no) => { reject = no; }));
  await act(async () => { root = create(<PingCard />); });
  let pending!: Promise<void>;
  await act(async () => { pending = heart().props.onPress(); });
  const session = (useSession as jest.Mock)();
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...session.backend } });
  await act(async () => { root.update(<PingCard />); });
  await act(async () => { reject(new Error('Panne fictive')); await pending; });
  expect(showDialog).not.toHaveBeenCalled();
});

test('le délai cœur se termine et le mode local peut enregistrer sans partenaire', async () => {
  jest.useFakeTimers();
  try {
    const session = (useSession as jest.Mock)();
    (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...session.backend, mode: 'local' }, partner: undefined });
    await act(async () => { root = create(<PingCard />); });
    await act(async () => { await heart().props.onPress(); });
    expect(text()).toContain('Cœur enregistré');
    expect(heart().props.disabled).toBe(true);
    await act(async () => { jest.advanceTimersByTime(2500); });
    expect(heart().props.disabled).toBe(false);
    await act(async () => { await heart().props.onPress(); });
    expect(sendLoveNote).toHaveBeenCalledTimes(2);
    await act(async () => { root.unmount(); });
  } finally {
    jest.useRealTimers();
  }
});
