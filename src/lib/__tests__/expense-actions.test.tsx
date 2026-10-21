import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';
import Depenses from '@/app/depenses';
import { useCollectionState, useSession } from '../couple-context';
import { confirmDelete } from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { success } from '../haptics';
import { functionMessage } from '../service-errors';

jest.mock('../couple-context', () => ({ useCollectionState: jest.fn(), useSession: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), cardShadow: () => ({}) }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { Pressable: { value: 'pressable' } }));
jest.mock('@/components/ui', () => ({ confirmDelete: jest.fn(), ...Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'Empty', 'Fab', 'Row', 'Dot', 'Ionicons', 'Sheet', 'Field', 'Chips'].map((name) => [name, name.toLowerCase()])) }));

let root: ReactTestRenderer;
const expense = { id: 'expense', title: 'Dépense fictive', amount: 40, paidBy: 'alice', kind: 'expense', createdAt: 1 };
const ready = { items: [expense], loading: false, error: false, retry: jest.fn() };
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', add: jest.fn(), call: jest.fn(), remove: jest.fn() };
const session = { backend, me: { id: 'alice' }, partner: { id: 'bob', name: 'Bob' }, members: [{ id: 'alice' }, { id: 'bob' }], nameOf: () => 'Alice', colorOf: () => '#000' };
beforeEach(() => {
  jest.clearAllMocks();
  backend.add.mockReset().mockResolvedValue(undefined); backend.remove.mockReset().mockResolvedValue(undefined);
  backend.call.mockReset().mockResolvedValue({ settlementId: 'confirmed-fictitious-id' });
  (useSession as jest.Mock).mockReturnValue(session);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const mount = async () => { await act(async () => { root = create(<Depenses />); }); };
const refresh = async () => { await act(async () => root.update(<Depenses />)); };
const settleButton = () => root.root.findByProps({ label: 'Marquer comme remboursé' });
const ask = async () => {
  await act(async () => root.root.findAllByType(Pressable)[0].props.onLongPress());
  return (confirmDelete as jest.Mock).mock.calls.at(-1)[1];
};

test.each(['unmount', 'backend', 'member', 'loading', 'error', 'removed'])('suppression de ligne ignorée après %s', async (kind) => {
  await mount(); const confirm = await ask();
  if (kind === 'backend' || kind === 'member') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: kind === 'member' ? 'bob' : 'alice' } });
  else (useCollectionState as jest.Mock).mockReturnValue({ ...ready, ...(kind === 'removed' ? { items: [] } : { [kind]: true }) });
  if (kind === 'unmount') await act(async () => root.unmount()); else await refresh();
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
});

test.each(['unmount', 'backend', 'member', 'partner', 'loading', 'error', 'changed'])('ancienne marque de remboursement ignorée après %s', async (kind) => {
  await mount(); const settle = settleButton().props.onPress;
  if (kind === 'backend' || kind === 'member') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: kind === 'member' ? 'bob' : 'alice' } });
  else if (kind === 'partner') (useSession as jest.Mock).mockReturnValue({ ...session, partner: undefined, members: [session.members[0]] });
  else (useCollectionState as jest.Mock).mockReturnValue({ ...ready, ...(kind === 'changed' ? { items: [{ ...expense, amount: 50 }] } : { [kind]: true }) });
  if (kind === 'unmount') await act(async () => root.unmount()); else await refresh();
  await act(async () => { await settle(); });
  expect(backend.call).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
});

test('suppression et marque informative partagent le verrou immédiat', async () => {
  await mount(); const confirm = await ask(); const settle = settleButton().props.onPress;
  let finish!: () => void;
  backend.call.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ settlementId: 'confirmed-fictitious-id' }); }));
  let pending!: Promise<void>;
  await act(async () => { pending = settle(); await settle(); await confirm(); });
  expect(backend.call).toHaveBeenCalledTimes(1);
  expect(backend.remove).not.toHaveBeenCalled();
  expect(settleButton().props.disabled).toBe(true);
  await act(async () => { finish(); await pending; });
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.call).toHaveBeenCalledTimes(1);
});

test('un nouveau solde confirmé utilise les valeurs courantes', async () => {
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.call).toHaveBeenLastCalledWith('recordSettlement', expect.objectContaining({ expected: [{ id: 'expense', amount: 40, paidBy: 'alice', kind: 'expense' }] }));
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...expense, amount: 60, paidBy: 'bob' }] });
  await refresh();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.call).toHaveBeenLastCalledWith('recordSettlement', expect.objectContaining({ expected: [{ id: 'expense', amount: 60, paidBy: 'bob', kind: 'expense' }] }));
  expect(backend.call).toHaveBeenCalledTimes(2);
});

test.each(['settle', 'delete'])('l’échec courant de %s reste visible et réessayable', async (action) => {
  await mount();
  const run = action === 'settle' ? settleButton().props.onPress : await ask();
  const method = action === 'settle' ? backend.call : backend.remove;
  method.mockRejectedValueOnce(new Error('Échec fictif'));
  await act(async () => { await run(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', action === 'settle' ? 'Vérifie l’historique après son actualisation avant de réessayer : la marque peut déjà avoir été enregistrée.' : 'Échec fictif');
  await act(async () => { await run(); });
  expect(method).toHaveBeenCalledTimes(2);
});

test.each(['settle', 'delete'])('l’erreur ancienne de %s est ignorée après changement de backend', async (action) => {
  await mount();
  const run = action === 'settle' ? settleButton().props.onPress : await ask();
  const method = action === 'settle' ? backend.call : backend.remove;
  let reject!: (error: Error) => void;
  method.mockImplementationOnce(() => new Promise<void>((_, no) => { reject = no; }));
  let pending!: Promise<void>;
  await act(async () => { pending = run(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
  await refresh();
  await act(async () => { reject(new Error('Ancien échec')); await pending; });
  expect(showDialog).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
});

test('une suppression en cours bloque aussi les autres commandes de la liste', async () => {
  await mount(); const confirm = await ask();
  let finish!: () => void;
  backend.remove.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = confirm(); await confirm(); await settleButton().props.onPress(); });
  expect(backend.remove).toHaveBeenCalledTimes(1);
  expect(backend.call).not.toHaveBeenCalled();
  await act(async () => { finish(); await pending; });
});

test('une réémission du même relevé ne permet pas de doubler la marque enregistrée', async () => {
  const second = { ...expense, id: 'second', amount: 10 };
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [expense, second] });
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...second, title: 'Autre titre' }, { ...expense }] });
  await refresh();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.call).toHaveBeenCalledTimes(1);
  expect(settleButton().props.disabled).toBe(true);
});

test('après un relevé différent, le retour au solde initial permet une nouvelle marque explicite', async () => {
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [] });
  await refresh();
  (useCollectionState as jest.Mock).mockReturnValue(ready);
  await refresh();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.call).toHaveBeenCalledTimes(2);
});

test('le cloud utilise la transaction sans envoyer les titres ni un montant de remboursement', async () => {
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.add).not.toHaveBeenCalled();
  expect(backend.call).toHaveBeenCalledWith('recordSettlement', {
    expectedUserId: 'alice', requestId: expect.stringMatching(/^[A-Za-z0-9_-]{12,80}$/),
    expected: [{ id: expense.id, amount: 40, paidBy: 'alice', kind: 'expense' }],
  });
});

test('une réponse perdue conserve le même identifiant pour la reprise, même après réémission du relevé', async () => {
  backend.call.mockRejectedValueOnce(new Error('Réponse fictive perdue'));
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...expense, title: 'Titre modifié' }] });
  await refresh();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.call).toHaveBeenCalledTimes(2);
  expect(backend.call.mock.calls[1][1]).toEqual(backend.call.mock.calls[0][1]);
  expect(backend.add).not.toHaveBeenCalled();
});

test.each([undefined, null, {}, { settlementId: '' }, { settlementId: 'other/path' }])('réponse serveur invalide %j : aucun faux succès ni repli direct', async (response) => {
  backend.call.mockResolvedValueOnce(response);
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  expect(success).not.toHaveBeenCalled();
  expect(showDialog).toHaveBeenCalledWith('Action impossible', expect.any(String));
  expect(settleButton().props.disabled).toBe(false);
  expect(backend.add).not.toHaveBeenCalled();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.call.mock.calls[1][1].requestId).toBe(backend.call.mock.calls[0][1].requestId);
});

test('une fonction absente ne retombe jamais sur un ajout direct non protégé', async () => {
  const message = functionMessage({ code: 'functions/not-found' });
  backend.call.mockRejectedValueOnce(new Error(message));
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.add).not.toHaveBeenCalled();
  expect(showDialog).toHaveBeenCalledWith('Action impossible', message);
});

test.each(['local', 'cloud'])('une marque %s appliquée sans confirmation ne divulgue pas de détail privé', async mode => {
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, mode } });
  const method = mode === 'local' ? backend.add : backend.call;
  method.mockImplementationOnce(async () => {
    (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [...ready.items, { id: 'settled', title: 'Remboursement', amount: 20, paidBy: 'bob', kind: 'settle', createdAt: 2 }] });
    throw new Error('Dépense intime fictive, clé interne du relevé');
  });
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  await refresh();
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Vérifie l’historique après son actualisation avant de réessayer : la marque peut déjà avoir été enregistrée.');
  expect(success).not.toHaveBeenCalled();
  expect(method).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(root.toJSON())).toContain('Vous êtes à l’équilibre');
});

test.each([
  'Le relevé a changé. Attends son actualisation avant de marquer le remboursement.',
  'Deux membres sont nécessaires pour marquer un remboursement.',
])('un refus métier connu reste explicite : %s', async message => {
  backend.call.mockRejectedValueOnce(new Error(message));
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', message);
});

test('un relevé réellement différent reçoit une nouvelle intention', async () => {
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  const first = backend.call.mock.calls[0]?.[1]?.requestId;
  expect(first).toEqual(expect.any(String));
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, items: [{ ...expense, amount: 60 }] });
  await refresh();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.call.mock.calls[1][1].requestId).not.toBe(first);
});

test('le mode local reste une annotation locale, sans appel serveur', async () => {
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, mode: 'local' } });
  await mount();
  await act(async () => { await settleButton().props.onPress(); });
  expect(backend.call).not.toHaveBeenCalled();
  expect(backend.add).toHaveBeenCalledWith('expenses', expect.objectContaining({ amount: 20, paidBy: 'bob', kind: 'settle' }));
});
