import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus, Pressable, Switch } from 'react-native';
import Home from '@/app/(tabs)/index';
import { useCollectionState, useSession } from '../couple-context';
import { confirmDelete } from '@/components/ui';
import { showDialog } from '@/components/dialog';
import { todayKey } from '../dates';

jest.mock('../couple-context', () => ({ useCollectionState: jest.fn(), useSession: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/components/invitation-card', () => ({ InvitationCard: () => null }));
jest.mock('@/components/home/home-hero', () => ({ HomeHero: () => null }));
jest.mock('@/components/home/love-cards', () => ({ NoteCard: () => null, PingCard: () => null }));
jest.mock('@/components/home/memories-strip', () => ({ MemoriesStrip: () => null }));
jest.mock('@/components/home/question-card', () => ({ QuestionCard: () => null }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), cardShadow: () => ({}) }));
jest.mock('@/components/pickers', () => ({ DateField: 'date' }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), { Pressable: { value: 'pressable' }, Switch: { value: 'switch' } }));
jest.mock('@/components/ui', () => ({ confirmDelete: jest.fn(), ...Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'Row', 'SectionTitle', 'Ionicons', 'Field', 'Sheet'].map((name) => [name, name.toLowerCase()])) }));

let root: ReactTestRenderer;
const date = { id: 'one', title: 'Date fictive', date: '2999-01-02', yearly: false, emoji: '' };
const ready = { items: [date], loading: false, error: false, retry: jest.fn() };
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice', remove: jest.fn(), add: jest.fn() };
const session = { backend, nameOf: () => 'Alice', colorOf: () => '#000' };
let dates = ready;
beforeEach(() => {
  jest.clearAllMocks();
  dates = ready;
  backend.remove.mockReset().mockResolvedValue(undefined);
  backend.add.mockReset().mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue(session);
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? dates : { ...ready, items: [] });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });
const button = (label: string) => root.root.findByProps({ label }).props.onPress;
const sheet = () => root.root.findByType('sheet' as never);
const field = () => root.root.findByProps({ label: 'Quoi ?' });
const mount = async () => { await act(async () => { root = create(<Home />); }); };
const refresh = async () => { await act(async () => root.update(<Home />)); };
const open = async () => { await act(async () => root.root.findByProps({ title: 'À venir' }).props.onAction()); };
const fill = async () => { await open(); await act(async () => field().props.onChangeText(' Brouillon fictif ')); };
const ask = async () => {
  await act(async () => root.root.findAllByType(Pressable).find((node) => node.props.onLongPress)!.props.onLongPress());
  return (confirmDelete as jest.Mock).mock.calls.at(-1)[1];
};

test('le retour le lendemain actualise agenda et compte à rebours sans perdre le formulaire', async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  jest.setSystemTime(new Date(2026, 9, 20, 23));
  let stateChanged!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    stateChanged = listener;
    return { remove: jest.fn() };
  });
  dates = { ...ready, items: [{ ...date, date: '2026-10-21' }] };
  const events = [
    { id: 'old', date: '2026-10-20', title: 'Ancien horaire fictif', start: '08:00', end: '09:00', who: 'alice' },
    { id: 'new', date: '2026-10-21', title: 'Nouvel horaire fictif', start: '08:00', end: '09:00', who: 'alice' },
  ];
  (useCollectionState as jest.Mock).mockImplementation((name) => name === 'dates' ? dates : { ...ready, items: events });
  await mount();
  const visibleText = () => root.root.findAllByType('t' as never).map(node => node.props.children).flat().join(' ');
  expect(visibleText()).toContain('Ancien horaire fictif');
  expect(visibleText()).toContain('J-1');
  await fill();
  await act(async () => stateChanged('background'));
  jest.setSystemTime(new Date(2026, 9, 21, 8));
  await act(async () => stateChanged('active'));
  const text = visibleText();
  expect(text).toContain('Nouvel horaire fictif');
  expect(text).not.toContain('Ancien horaire fictif');
  expect(text).toContain('Jour J');
  expect(field().props.value).toBe(' Brouillon fictif ');
  expect(backend.add).not.toHaveBeenCalled();
  expect(backend.remove).not.toHaveBeenCalled();
});

test.each(['unmount', 'backend', 'member', 'loading', 'error', 'removed'])('confirmation de date ignorée après %s', async (kind) => {
  await mount();
  const confirm = await ask();
  if (kind === 'backend' || kind === 'member') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: kind === 'member' ? 'bob' : 'alice' } });
  else dates = { ...ready, ...(kind === 'removed' ? { items: [] } : { [kind]: true }) };
  if (kind === 'unmount') await act(async () => root.unmount()); else await refresh();
  await act(async () => { await confirm(); });
  expect(backend.remove).not.toHaveBeenCalled();
});

test('deux confirmations simultanées ne suppriment qu’une fois', async () => {
  await mount();
  const confirm = await ask();
  await act(async () => { await Promise.all([confirm(), confirm()]); });
  expect(backend.remove).toHaveBeenCalledTimes(1);
  expect(backend.remove).toHaveBeenCalledWith('dates', date.id);
});

test('un échec de suppression est visible et permet une reprise', async () => {
  await mount();
  const confirm = await ask();
  backend.remove.mockRejectedValueOnce(new Error('Suppression fictive refusée'));
  await act(async () => { await confirm(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Suppression fictive refusée');
  await act(async () => { await confirm(); });
  expect(backend.remove).toHaveBeenCalledTimes(2);
});

test.each(['closed', 'reopened', 'backend', 'member', 'loading', 'error'])('ancienne création bloquée après %s', async (kind) => {
  await mount(); await fill();
  const save = button('Ajouter');
  if (kind === 'closed' || kind === 'reopened') {
    await act(async () => sheet().props.onClose());
    if (kind === 'reopened') await open();
  } else {
    if (kind === 'backend' || kind === 'member') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: kind === 'member' ? 'bob' : 'alice' } });
    else dates = { ...ready, [kind]: true };
    await refresh();
  }
  await act(async () => { await save(); });
  expect(backend.add).not.toHaveBeenCalled();
  if (kind === 'reopened') expect(field().props.value).toBe('');
  if (kind === 'loading' || kind === 'error') expect(field().props.value).toBe(' Brouillon fictif ');
});

test('création, saisie et fermeture partagent le verrou immédiat', async () => {
  await mount(); await fill();
  const changeTitle = field().props.onChangeText;
  const changeDate = root.root.findByType('date' as never).props.onChange;
  const changeYearly = root.root.findByType(Switch).props.onValueChange;
  let finish!: () => void;
  backend.add.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  const save = button('Ajouter');
  await act(async () => { pending = save(); await save(); await changeTitle('Trop tard'); await changeDate('2999-02-03'); await changeYearly(true); sheet().props.onClose(); });
  expect(backend.add).toHaveBeenCalledTimes(1);
  expect(backend.add).toHaveBeenCalledWith('dates', { title: 'Brouillon fictif', emoji: '', date: todayKey(), yearly: false });
  expect(field().props).toMatchObject({ value: ' Brouillon fictif ', editable: false });
  expect(root.root.findByType('date' as never).props).toMatchObject({ value: todayKey(), disabled: true });
  expect(root.root.findByType(Switch).props).toMatchObject({ value: false, disabled: true });
  await act(async () => { finish(); await pending; });
  expect(root.root.findAllByType('sheet' as never)).toHaveLength(0);
});

test('un échec conserve le brouillon et permet une nouvelle tentative', async () => {
  await mount(); await fill();
  backend.add.mockRejectedValueOnce(new Error('Échec fictif'));
  await act(async () => { await button('Ajouter')(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Échec fictif');
  expect(field().props).toMatchObject({ value: ' Brouillon fictif ', editable: true });
  await act(async () => { await button('Ajouter')(); });
  expect(backend.add).toHaveBeenCalledTimes(2);
});

test.each(['success', 'error'])('un retour %s d’un ancien backend ne ferme pas le formulaire courant', async (outcome) => {
  await mount(); await fill();
  let finish!: () => void;
  backend.add.mockImplementationOnce(() => new Promise<void>((resolve, reject) => { finish = () => outcome === 'success' ? resolve() : reject(new Error('Ancien échec')); }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Ajouter')(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
  await refresh();
  await act(async () => { finish(); await pending; });
  expect(sheet().props.visible).toBe(true);
  expect(field().props.value).toBe(' Brouillon fictif ');
  expect(showDialog).not.toHaveBeenCalled();
});

test('un titre vide est refusé dans l’action, pas seulement par le bouton', async () => {
  await mount(); await open();
  await act(async () => { await button('Ajouter')(); });
  expect(backend.add).not.toHaveBeenCalled();
});

test('le formulaire conserve son brouillon et propose une reprise de lecture', async () => {
  await mount(); await fill();
  dates = { ...ready, error: true };
  await refresh();
  await act(async () => button('Recharger les dates du formulaire')());
  expect(ready.retry).toHaveBeenCalledTimes(1);
  expect(field().props.value).toBe(' Brouillon fictif ');
});

test('une ancienne action relit titre, date et répétition courants', async () => {
  await mount(); await fill();
  const oldSave = button('Ajouter');
  await act(async () => {
    field().props.onChangeText(' Nouvelle date fictive ');
    root.root.findByType('date' as never).props.onChange('2030-03-04');
    root.root.findByType(Switch).props.onValueChange(true);
  });
  await act(async () => { await oldSave(); });
  expect(backend.add).toHaveBeenCalledWith('dates', { title: 'Nouvelle date fictive', emoji: '', date: '2030-03-04', yearly: true });
});

test('une ancienne action ne contourne pas un titre vidé ensuite', async () => {
  await mount(); await fill();
  const oldSave = button('Ajouter');
  await act(async () => field().props.onChangeText('  '));
  await act(async () => { await oldSave(); });
  expect(backend.add).not.toHaveBeenCalled();
  expect(sheet().props.visible).toBe(true);
});

test('une action obtenue avant saisie utilise la nouvelle date valide', async () => {
  await mount(); await open();
  const oldSave = button('Ajouter');
  await act(async () => field().props.onChangeText('Fictif'));
  await act(async () => { await oldSave(); });
  expect(backend.add).toHaveBeenCalledWith('dates', expect.objectContaining({ title: 'Fictif' }));
});
