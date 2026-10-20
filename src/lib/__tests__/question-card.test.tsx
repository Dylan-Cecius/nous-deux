import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QuestionCard } from '@/components/home/question-card';
import { useCollectionState, useSession } from '../couple-context';
import { todayKey } from '../dates';
import { notifyPartner } from '../assistant';
import { showDialog } from '@/components/dialog';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return { useCollection: () => state().items, useCollectionState: state, useSession: jest.fn() };
});
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  AppState: { value: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) } },
}));
jest.mock('../dates', () => ({ todayKey: jest.fn() }));
jest.mock('../questions', () => ({ questionFor: () => 'Question de test' }));
jest.mock('../assistant', () => ({ notifyPartner: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}) }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Card', 'T', 'Button', 'Field', 'IconButton', 'Row', 'Dot', 'Ionicons'].map((name) => [
    name, (props: object) => React.createElement(name.toLowerCase(), props),
  ]));
});

let root: ReactTestRenderer;
const members = [{ id: 'alice', name: 'Alice', color: '#000' }, { id: 'bob', name: 'Bob', color: '#fff' }];
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', add: jest.fn() };
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const text = () => JSON.stringify(root.toJSON());
const fields = () => root.root.findAllByType('field' as never);
beforeEach(() => {
  backend.add.mockReset().mockResolvedValue('answer-id');
  (useSession as jest.Mock).mockReturnValue({ backend, members, me: members[0] });
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  (todayKey as jest.Mock).mockReturnValue('2026-10-15');
});

const mount = async () => { await act(async () => { root = create(<QuestionCard />); }); };
const refresh = async () => { await act(async () => root.update(<QuestionCard />)); };
const fill = async () => { await mount(); await act(async () => fields()[0].props.onChangeText(' Réponse fictive ')); };
const submit = () => root.root.findByProps({ label: 'Valider la réponse' }).props.onPress;

test('les réponses locales ont des noms accessibles distincts sans reprendre le texte saisi', async () => {
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, mode: 'local' }, members, me: members[0] });
  await mount();
  expect(fields().map(field => field.props.accessibilityLabel)).toEqual(['Ta réponse à la question du jour', 'Réponse de Bob à la question du jour']);
  await act(async () => fields()[0].props.onChangeText('Texte privé fictif'));
  expect(fields()[0].props.accessibilityLabel).toBe('Ta réponse à la question du jour');
});

test('clavier et bouton simultanés partagent un seul envoi', async () => {
  await fill();
  const save = submit();
  await act(async () => { await Promise.all([save(), fields()[0].props.onSubmitEditing()]); });
  expect(backend.add).toHaveBeenCalledTimes(1);
  expect(notifyPartner).toHaveBeenCalledTimes(1);
});

test.each(['unmount', 'date', 'member', 'backend', 'removed', 'loading', 'error', 'answered'])('ancienne réponse refusée après %s', async (kind) => {
  await fill(); const save = submit();
  if (kind === 'unmount') await act(async () => root.unmount());
  else {
    if (kind === 'date') (todayKey as jest.Mock).mockReturnValue('2026-10-16');
    if (kind === 'member' || kind === 'backend') (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, userId: kind === 'member' ? 'bob' : 'alice' }, members, me: members[0] });
    if (kind === 'removed') (useSession as jest.Mock).mockReturnValue({ backend, members: [members[1]], me: members[0] });
    if (kind === 'loading' || kind === 'error') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [kind]: true });
    if (kind === 'answered') (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ id: 'existing', from: 'alice', date: '2026-10-15', text: 'Autre appareil', createdAt: 1 }] });
    await refresh();
  }
  await act(async () => { await save(); });
  expect(backend.add).not.toHaveBeenCalled();
  expect(notifyPartner).not.toHaveBeenCalled();
});

test('une ancienne action relit le brouillon courant', async () => {
  await fill(); const save = submit();
  await act(async () => fields()[0].props.onChangeText(' Nouvelle réponse '));
  await act(async () => { await save(); });
  expect(backend.add).toHaveBeenCalledWith('answers', expect.objectContaining({ text: 'Nouvelle réponse' }));
});

test('le changement de jour refuse l’ancienne réponse même avant un nouveau rendu', async () => {
  await fill();
  const save = submit();
  (todayKey as jest.Mock).mockReturnValue('2026-10-16');
  await act(async () => save());
  expect(backend.add).not.toHaveBeenCalled();
  expect(notifyPartner).not.toHaveBeenCalled();
});

test('le passage au lendemain actualise la question sans changement de collection', async () => {
  jest.useFakeTimers();
  await fill();
  (todayKey as jest.Mock).mockReturnValue('2026-10-16');
  await act(async () => jest.advanceTimersByTime(61_000));
  expect(fields()[0].props.value).toBe('');
  expect(backend.add).not.toHaveBeenCalled();
});

test('une réponse tardive du jour précédent ne notifie pas le partenaire', async () => {
  await fill();
  let finish!: () => void;
  backend.add.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = submit()(); });
  (todayKey as jest.Mock).mockReturnValue('2026-10-16');
  await act(async () => { finish(); await pending; });
  expect(notifyPartner).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});

test('une réponse vidée ensuite ne part pas depuis une ancienne action', async () => {
  await fill(); const save = submit();
  await act(async () => fields()[0].props.onChangeText('  '));
  await act(async () => { await save(); });
  expect(backend.add).not.toHaveBeenCalled();
});

test.each(['Dernière saisie', ''])('la validation avant rendu utilise la dernière saisie (%s)', async (value) => {
  await fill();
  const change = fields()[0].props.onChangeText;
  const save = submit();
  await act(async () => { change(value); await save(); });
  if (value) expect(backend.add).toHaveBeenCalledWith('answers', expect.objectContaining({ text: value }));
  else expect(backend.add).not.toHaveBeenCalled();
});

test('une première saisie immédiatement validée n’est pas ignorée', async () => {
  await mount();
  const change = fields()[0].props.onChangeText;
  const save = submit();
  await act(async () => { change('Première réponse'); await save(); });
  expect(backend.add).toHaveBeenCalledWith('answers', expect.objectContaining({ text: 'Première réponse' }));
});

test('les deux saisies locales avant rendu restent distinctes', async () => {
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, mode: 'local' }, members, me: members[0] });
  await mount();
  const [first, second] = fields().map(field => field.props.onChangeText);
  const actions = root.root.findAllByProps({ label: 'Valider la réponse' }).filter(node => typeof node.type === 'string').map(node => node.props.onPress);
  await act(async () => { first('Réponse Alice'); second('Réponse Bob'); await actions[0](); await actions[1](); });
  expect(backend.add).toHaveBeenCalledWith('answers', expect.objectContaining({ from: 'alice', text: 'Réponse Alice' }));
  expect(backend.add).toHaveBeenCalledWith('answers', expect.objectContaining({ from: 'bob', text: 'Réponse Bob' }));
  expect(notifyPartner).not.toHaveBeenCalled();
});

test.each(['success', 'error'])('retour %s après départ sans notification ni dialogue tardif', async (outcome) => {
  await fill(); let finish!: () => void;
  backend.add.mockImplementationOnce(() => new Promise((resolve, reject) => { finish = () => outcome === 'success' ? resolve('id') : reject(new Error('Erreur fictive')); }));
  let pending!: Promise<void>;
  await act(async () => { pending = submit()(); });
  await act(async () => root.unmount());
  await act(async () => { finish(); await pending; });
  expect(notifyPartner).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.useRealTimers(); jest.clearAllMocks(); });

test.each(['loading', 'error'])('la question en %s ne propose pas de réponse et n’invente pas de statut', async (status) => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, loading: status === 'loading', error: status === 'error' });
  await act(async () => { root = create(<QuestionCard />); });
  expect(fields()).toHaveLength(0);
  expect(text()).not.toContain('Pas encore répondu');
  expect(text()).not.toContain('Valider la réponse');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer' }).props.onPress(); });
    expect(ready.retry).toHaveBeenCalledTimes(1);
  } else {
    expect(text()).toContain('Chargement des réponses');
  }
  expect(backend.add).not.toHaveBeenCalled();
  expect(notifyPartner).not.toHaveBeenCalled();
});

test('le brouillon revient après une erreur et une reprise sans envoi automatique', async () => {
  await act(async () => { root = create(<QuestionCard />); });
  await act(async () => { fields()[0].props.onChangeText('Brouillon fictif'); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await act(async () => { root.update(<QuestionCard />); });
  expect(fields()).toHaveLength(0);
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, loading: true });
  await act(async () => { root.update(<QuestionCard />); });
  expect(fields()).toHaveLength(0);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  await act(async () => { root.update(<QuestionCard />); });
  expect(fields()[0].props.value).toBe('Brouillon fictif');
  expect(backend.add).not.toHaveBeenCalled();
  expect(notifyPartner).not.toHaveBeenCalled();
});

test.each(['date', 'compte'])('un changement de %s ne réutilise pas le brouillon précédent', async (change) => {
  await act(async () => { root = create(<QuestionCard />); });
  await act(async () => { fields()[0].props.onChangeText('Brouillon ancien'); });
  if (change === 'date') (todayKey as jest.Mock).mockReturnValue('2026-10-16');
  else (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, userId: 'bob' }, members, me: members[1] });
  await act(async () => { root.update(<QuestionCard />); });
  expect(fields()[0].props.value).toBe('');
});

test('un statut du partenaire reste verrouillé et une réponse révélée s’affiche après ma réponse', async () => {
  const partner = { id: 'bob-answer', from: 'bob', date: '2026-10-15', text: '', createdAt: 1 };
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [partner] });
  await act(async () => { root = create(<QuestionCard />); });
  expect(fields()).toHaveLength(1);
  expect(text()).toContain('A déjà répondu');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [
    { ...partner, text: 'Texte révélé fictif' },
    { ...partner, id: 'alice-answer', from: 'alice', text: 'Ma réponse fictive' },
  ] });
  await act(async () => { root.update(<QuestionCard />); });
  expect(fields()).toHaveLength(0);
  expect(text()).toContain('Texte révélé fictif');
  expect(text()).toContain('Ma réponse fictive');
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await act(async () => { root.update(<QuestionCard />); });
  expect(text()).not.toContain('Texte révélé fictif');
});

test('le masquage client ne révèle pas le texte du partenaire sans ma réponse', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [
    { id: 'test', from: 'bob', date: '2026-10-15', text: 'Texte fictif à masquer', createdAt: 1 },
  ] });
  await act(async () => { root = create(<QuestionCard />); });
  expect(text()).not.toContain('Texte fictif à masquer');
  expect(text()).toContain('A déjà répondu');
});

test('les deux brouillons locaux sont distincts et conservés après reprise', async () => {
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, mode: 'local' }, members, me: members[0] });
  await act(async () => { root = create(<QuestionCard />); });
  expect(fields()).toHaveLength(2);
  await act(async () => {
    fields()[0].props.onChangeText('Brouillon Alice');
    fields()[1].props.onChangeText('Brouillon Bob');
  });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await act(async () => { root.update(<QuestionCard />); });
  expect(fields()).toHaveLength(0);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  await act(async () => { root.update(<QuestionCard />); });
  expect(fields().map((field) => field.props.value)).toEqual(['Brouillon Alice', 'Brouillon Bob']);
  expect(backend.add).not.toHaveBeenCalled();
});

test('le verrou survit à une panne de lecture et protège aussi une ancienne saisie', async () => {
  await fill(); const save = submit(); const change = fields()[0].props.onChangeText;
  let finish!: () => void;
  backend.add.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = save(); change('Trop tard'); });
  expect(fields()[0].props).toMatchObject({ value: ' Réponse fictive ', editable: false });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true }); await refresh();
  (useCollectionState as jest.Mock).mockReturnValue(ready); await refresh();
  await act(async () => { await submit()(); });
  expect(backend.add).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); await pending; });
  expect(notifyPartner).not.toHaveBeenCalled();
  expect(text()).toContain('Réponse enregistrée');
  await act(async () => { await submit()(); });
  expect(backend.add).toHaveBeenCalledTimes(1);
});

test('une ancienne action reste invalide après aller-retour de la lecture', async () => {
  await fill(); const oldSave = submit();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, loading: true }); await refresh();
  (useCollectionState as jest.Mock).mockReturnValue(ready); await refresh();
  await act(async () => { await oldSave(); });
  expect(backend.add).not.toHaveBeenCalled();
  await act(async () => { await submit()(); });
  expect(backend.add).toHaveBeenCalledTimes(1);
});

test('un rejet reste non confirmé, garde la saisie et autorise une reprise explicite', async () => {
  await fill(); backend.add.mockRejectedValueOnce(new Error('Détail fournisseur à masquer'));
  await act(async () => { await submit()(); });
  expect(showDialog).toHaveBeenCalledWith('Enregistrement non confirmé', expect.stringContaining('vérifier'));
  expect(JSON.stringify((showDialog as jest.Mock).mock.calls)).not.toContain('Détail fournisseur');
  expect(fields()[0].props).toMatchObject({ value: ' Réponse fictive ', editable: true });
  expect(notifyPartner).not.toHaveBeenCalled();
  await act(async () => { await submit()(); });
  expect(backend.add).toHaveBeenCalledTimes(2);
  expect(notifyPartner).toHaveBeenCalledTimes(1);
});

test('les deux membres locaux peuvent répondre sans notification cloud', async () => {
  (useSession as jest.Mock).mockReturnValue({ backend: { ...backend, mode: 'local' }, members, me: members[0] });
  await mount();
  await act(async () => { fields()[0].props.onChangeText('Alice'); fields()[1].props.onChangeText('Bob'); });
  await act(async () => { await Promise.all(fields().map((field) => field.props.onSubmitEditing())); });
  expect(backend.add).toHaveBeenCalledTimes(2);
  expect(backend.add).toHaveBeenCalledWith('answers', expect.objectContaining({ from: 'alice', text: 'Alice' }));
  expect(backend.add).toHaveBeenCalledWith('answers', expect.objectContaining({ from: 'bob', text: 'Bob' }));
  expect(notifyPartner).not.toHaveBeenCalled();
});
