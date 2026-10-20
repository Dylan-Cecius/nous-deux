import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Depenses from '@/app/depenses';
import { useCollectionState, useSession } from '../couple-context';
import { showDialog } from '@/components/dialog';
import { success } from '../haptics';

jest.mock('../couple-context', () => ({ useCollectionState: jest.fn(), useSession: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), cardShadow: () => ({}) }));
jest.mock('@/components/ui', () => Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'Empty', 'Fab', 'Row', 'Dot', 'Ionicons', 'Sheet', 'Field', 'Chips'].map((name) => [name, name.toLowerCase()])));

let root: ReactTestRenderer;
const ready = { items: [], loading: false, error: false, retry: jest.fn() };
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', add: jest.fn() };
const session = { backend, me: { id: 'alice' }, partner: { id: 'bob', name: 'Bob' }, members: [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }], nameOf: () => 'Alice', colorOf: () => '#000' };
beforeEach(() => {
  jest.clearAllMocks();
  backend.add.mockReset().mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue(session);
  (useCollectionState as jest.Mock).mockReturnValue(ready);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const field = (label: string) => root.root.findByProps({ label });
const save = () => field('Ajouter').props.onPress;
const sheet = () => root.root.findByType('sheet' as never);
const open = async () => { await act(async () => field('Ajouter une dépense').props.onPress()); };
const mount = async () => {
  await act(async () => { root = create(<Depenses />); });
  await open();
  await act(async () => { field('Quoi ?').props.onChangeText(' Dépense fictive '); field('Montant (€)').props.onChangeText('42,50'); });
};
const refresh = async () => { await act(async () => root.update(<Depenses />)); };

test.each(['title', 'amount', 'payer', 'all'])('la validation immédiate conserve la dernière saisie : %s', async (kind) => {
  await mount();
  const submit = save();
  await act(async () => {
    if (kind === 'title' || kind === 'all') field('Quoi ?').props.onChangeText(' Dernier titre ');
    if (kind === 'amount' || kind === 'all') field('Montant (€)').props.onChangeText('17,239');
    if (kind === 'payer' || kind === 'all') field('Payé par').props.onChange('bob');
    await submit();
  });
  expect(backend.add).toHaveBeenCalledTimes(1);
  expect(backend.add).toHaveBeenCalledWith('expenses', expect.objectContaining({
    title: kind === 'title' || kind === 'all' ? 'Dernier titre' : 'Dépense fictive',
    amount: kind === 'amount' || kind === 'all' ? 17.24 : 42.5,
    paidBy: kind === 'payer' || kind === 'all' ? 'bob' : 'alice',
  }));
});

test.each(['title', 'amount', 'payer'])('une saisie devenue invalide avant le rendu bloque l’ajout : %s', async (kind) => {
  await mount();
  const submit = save();
  await act(async () => {
    if (kind === 'title') field('Quoi ?').props.onChangeText('  ');
    if (kind === 'amount') field('Montant (€)').props.onChangeText('100001');
    if (kind === 'payer') field('Payé par').props.onChange('stranger');
    await submit();
  });
  expect(backend.add).not.toHaveBeenCalled();
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(1);
});

test.each(['closed', 'reopened', 'backend', 'member', 'loading', 'error'])('création de dépense bloquée après %s', async (kind) => {
  await mount(); const oldSave = save();
  if (kind === 'closed' || kind === 'reopened') {
    await act(async () => sheet().props.onClose());
    if (kind === 'reopened') await open();
  } else {
    if (kind === 'backend' || kind === 'member') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: kind === 'member' ? 'bob' : 'alice' } });
    else (useCollectionState as jest.Mock).mockReturnValue({ ...ready, [kind]: true });
    await refresh();
  }
  await act(async () => { await oldSave(); });
  expect(backend.add).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  if (kind === 'reopened') expect(field('Quoi ?').props.value).toBe('');
  if (kind === 'loading' || kind === 'error') expect(field('Quoi ?').props.value).toBe(' Dépense fictive ');
});

test.each(['', '0', '-1', '100001', 'abc'])('la validation refuse réellement le montant %s', async (amount) => {
  await mount();
  await act(async () => field('Montant (€)').props.onChangeText(amount));
  await act(async () => { await save()(); });
  expect(backend.add).not.toHaveBeenCalled();
});

test.each(['empty', 'unknown', 'left'])('titre ou payeur invalide (%s) empêche l’enregistrement', async (kind) => {
  await mount();
  if (kind === 'empty') await act(async () => field('Quoi ?').props.onChangeText('  '));
  else if (kind === 'unknown') await act(async () => field('Payé par').props.onChange('stranger'));
  else {
    await act(async () => field('Payé par').props.onChange('bob'));
    (useSession as jest.Mock).mockReturnValue({ ...session, partner: undefined, members: [session.members[0]] });
    await refresh();
  }
  await act(async () => { await save()(); });
  expect(backend.add).not.toHaveBeenCalled();
});

test('saisie et fermeture sont verrouillées avec l’ajout', async () => {
  await mount();
  const title = field('Quoi ?').props.onChangeText, amount = field('Montant (€)').props.onChangeText, payer = field('Payé par').props.onChange;
  const submit = save();
  let finish!: () => void;
  backend.add.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = submit(); await submit(); await title('Trop tard'); await amount('100'); await payer('bob'); sheet().props.onClose(); });
  expect(backend.add).toHaveBeenCalledTimes(1);
  expect(backend.add).toHaveBeenCalledWith('expenses', expect.objectContaining({ title: 'Dépense fictive', amount: 42.5, paidBy: 'alice', kind: 'expense' }));
  expect(field('Quoi ?').props).toMatchObject({ value: ' Dépense fictive ', editable: false });
  expect(field('Montant (€)').props).toMatchObject({ value: '42,50', editable: false });
  expect(field('Payé par').props).toMatchObject({ value: 'alice', disabled: true });
  await act(async () => { finish(); await pending; });
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
  expect(success).toHaveBeenCalledTimes(1);
});

test('un échec conserve la saisie et permet de réessayer', async () => {
  await mount();
  backend.add.mockRejectedValueOnce(new Error('Échec fictif'));
  await act(async () => { await save()(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Échec fictif');
  expect(field('Montant (€)').props).toMatchObject({ value: '42,50', editable: true });
  await act(async () => { await save()(); });
  expect(backend.add).toHaveBeenCalledTimes(2);
});

test.each(['success', 'error'])('un ancien résultat %s ne ferme pas le brouillon ni ne vibre', async (result) => {
  await mount();
  let finish!: () => void;
  backend.add.mockImplementationOnce(() => new Promise<void>((resolve, reject) => { finish = () => result === 'success' ? resolve() : reject(new Error('Ancien échec')); }));
  let pending!: Promise<void>;
  await act(async () => { pending = save()(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
  await refresh();
  await act(async () => { finish(); await pending; });
  expect(field('Quoi ?').props.value).toBe(' Dépense fictive ');
  expect(success).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});

test('une panne de lecture du formulaire peut être relancée sans perdre le montant', async () => {
  await mount();
  (useCollectionState as jest.Mock).mockReturnValue({ ...ready, error: true });
  await refresh();
  await act(async () => field('Recharger les dépenses du formulaire').props.onPress());
  expect(ready.retry).toHaveBeenCalledTimes(1);
  expect(field('Montant (€)').props.value).toBe('42,50');
});

test('un ancien bouton enregistre les champs courants, pas un ancien montant ou payeur', async () => {
  await mount();
  const oldSave = save();
  await act(async () => {
    field('Quoi ?').props.onChangeText(' Nouvelle dépense fictive ');
    field('Montant (€)').props.onChangeText('17,239');
    field('Payé par').props.onChange('bob');
  });
  await act(async () => { await oldSave(); });
  expect(backend.add).toHaveBeenCalledWith('expenses', expect.objectContaining({ title: 'Nouvelle dépense fictive', amount: 17.24, paidBy: 'bob' }));
});

test.each(['title', 'amount', 'payer'])('un ancien bouton ne contourne pas la validation courante : %s', async kind => {
  await mount();
  const oldSave = save();
  await act(async () => {
    if (kind === 'title') field('Quoi ?').props.onChangeText('  ');
    if (kind === 'amount') field('Montant (€)').props.onChangeText('100001');
    if (kind === 'payer') field('Payé par').props.onChange('stranger');
  });
  await act(async () => { await oldSave(); });
  expect(backend.add).not.toHaveBeenCalled();
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(1);
});

test('un bouton obtenu avant la saisie relit les valeurs devenues valides', async () => {
  await act(async () => { root = create(<Depenses />); });
  await open();
  const oldSave = save();
  await act(async () => { field('Quoi ?').props.onChangeText('Fictif'); field('Montant (€)').props.onChangeText('9,90'); });
  await act(async () => { await oldSave(); });
  expect(backend.add).toHaveBeenCalledWith('expenses', expect.objectContaining({ title: 'Fictif', amount: 9.9 }));
});
