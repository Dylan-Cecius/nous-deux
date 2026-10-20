import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import Depenses from '@/app/depenses';
import { useCollectionState } from '../couple-context';
import { AppState } from 'react-native';

jest.mock('../couple-context', () => ({
  useCollection: jest.fn(() => []),
  useCollectionState: jest.fn(),
  useSession: () => ({ backend: {}, me: { id: 'alice' }, partner: { id: 'bob', name: 'Bob' }, members: [], nameOf: jest.fn(), colorOf: jest.fn() }),
}));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), cardShadow: () => ({}) }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: jest.fn(), replace: jest.fn() } }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'Empty', 'Fab', 'Row', 'Dot', 'Ionicons', 'Sheet', 'Field', 'Chips'].map((name) => [
    name, (props: object) => React.createElement(name.toLowerCase(), props),
  ]));
});

let root: ReactTestRenderer;
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });

test('la date de dépense devient hier à minuit en conservant le formulaire ouvert', async () => {
  jest.useFakeTimers();
  const state = AppState.currentState;
  AppState.currentState = 'active';
  jest.setSystemTime(new Date(2026, 9, 20, 23, 59, 50));
  (useCollectionState as jest.Mock).mockReturnValue({ items: [{ id: 'test', title: 'Courses fictives', amount: 40, paidBy: 'alice', kind: 'expense', createdAt: new Date(2026, 9, 20, 23).getTime() }], loading: false, error: false, retry: jest.fn() });
  try {
    await act(async () => { root = create(<Depenses />); });
    await act(async () => root.root.findByProps({ label: 'Ajouter une dépense' }).props.onPress());
    await act(async () => root.root.findByProps({ label: 'Quoi ?' }).props.onChangeText('Brouillon de minuit'));
    expect(JSON.stringify(root.toJSON())).toContain('aujourd’hui à 23:00');
    await act(async () => { jest.advanceTimersByTime(10_050); });
    expect(JSON.stringify(root.toJSON())).toContain('hier');
    expect(JSON.stringify(root.toJSON())).not.toContain('aujourd’hui');
    expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe('Brouillon de minuit');
  } finally {
    await act(async () => root?.unmount());
    AppState.currentState = state;
    jest.useRealTimers();
  }
});

test.each([true, false])('retour des dépenses avec historique : %s', async (hasHistory) => {
  (router.canGoBack as jest.Mock).mockReturnValue(hasHistory);
  (useCollectionState as jest.Mock).mockReturnValue({ items: [], loading: false, error: false, retry: jest.fn() });
  await act(async () => { root = create(<Depenses />); });
  await act(async () => { root.root.findByType('screen' as never).props.onBack(); });
  expect(router.back).toHaveBeenCalledTimes(hasHistory ? 1 : 0);
  if (hasHistory) expect(router.replace).not.toHaveBeenCalled();
  else expect(router.replace).toHaveBeenCalledWith('/');
});

test.each(['loading', 'error'])('les dépenses en %s n’affichent ni faux équilibre ni remboursement', async (status) => {
  const retry = jest.fn();
  (useCollectionState as jest.Mock).mockReturnValue({ items: [], loading: status === 'loading', error: status === 'error', retry });
  await act(async () => { root = create(<Depenses />); });
  const content = JSON.stringify(root.toJSON());
  expect(content).not.toContain('Vous êtes à l’équilibre');
  expect(content).not.toContain('dépensés à deux');
  expect(content).not.toContain('Marquer comme remboursé');
  if (status === 'error') {
    await act(async () => { root.root.findByProps({ label: 'Réessayer' }).props.onPress(); });
    expect(retry).toHaveBeenCalledTimes(1);
  } else {
    expect(content).toContain('Chargement des dépenses');
  }
});

test('une collection réellement vide peut afficher un solde à l’équilibre', async () => {
  (useCollectionState as jest.Mock).mockReturnValue({ items: [], loading: false, error: false, retry: jest.fn() });
  await act(async () => { root = create(<Depenses />); });
  expect(JSON.stringify(root.toJSON())).toContain('Vous êtes à l’équilibre');
});

test('une erreur masque les anciens montants sans perdre le brouillon ouvert', async () => {
  const state = { items: [{ id: 'test', title: 'Courses', amount: 40, paidBy: 'alice', kind: 'expense', createdAt: 1 }], loading: false, error: false, retry: jest.fn() };
  (useCollectionState as jest.Mock).mockReturnValue(state);
  await act(async () => { root = create(<Depenses />); });
  expect(JSON.stringify(root.toJSON())).toContain('Marquer comme remboursé');
  await act(async () => { root.root.findByProps({ label: 'Ajouter une dépense' }).props.onPress(); });
  await act(async () => { root.root.findByProps({ label: 'Quoi ?' }).props.onChangeText('Brouillon de test'); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...state, error: true });
  await act(async () => { root.update(<Depenses />); });
  const content = JSON.stringify(root.toJSON());
  expect(content).not.toContain('Marquer comme remboursé');
  expect(content).not.toContain('dépensés à deux');
  expect(root.root.findByProps({ label: 'Quoi ?' }).props.value).toBe('Brouillon de test');
});
