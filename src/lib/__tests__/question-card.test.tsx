import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QuestionCard } from '@/components/home/question-card';
import { useCollectionState, useSession } from '../couple-context';
import { todayKey } from '../dates';
import { notifyPartner } from '../assistant';

jest.mock('../couple-context', () => {
  const state = jest.fn();
  return { useCollection: () => state().items, useCollectionState: state, useSession: jest.fn() };
});
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
  (useSession as jest.Mock).mockReturnValue({ backend, members, me: members[0] });
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  (todayKey as jest.Mock).mockReturnValue('2026-10-15');
});
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });

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
