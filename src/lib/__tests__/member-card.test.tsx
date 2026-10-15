import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Nous from '@/app/(tabs)/nous';
import { useSession } from '../couple-context';
import { showDialog } from '@/components/dialog';

jest.mock('../couple-context', () => ({ useCollectionState: () => ({ items: [], loading: false, error: false }), useSession: jest.fn() }));
jest.mock('../notifications', () => ({}));
jest.mock('../backend', () => ({ currentAccount: jest.fn() }));
jest.mock('@/components/account', () => ({ AccountCard: () => null }));
jest.mock('@/components/invitation-card', () => ({ InvitationCard: () => null }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('../haptics', () => ({ tap: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}), usePrefs: () => ({}), AccentThemes: {}, MemberColors: ['#111111', '#222222'], cardShadow: () => ({}) }));
jest.mock('@/components/ui', () => Object.fromEntries(['Screen', 'Card', 'T', 'Button', 'Avatar', 'ColorPicker', 'Field', 'Ionicons', 'Row'].map((name) => [name, name.toLowerCase()])));

let root: ReactTestRenderer;
const member = { id: 'alice', name: 'Alice', color: '#111111' };
const backend = { mode: 'cloud', userId: 'alice', coupleId: 'test', updateMember: jest.fn() };
const session = { backend, members: [member] };
beforeEach(() => {
  jest.clearAllMocks(); backend.updateMember.mockReset().mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue(session);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const input = () => root.root.findByProps({ accessibilityLabel: 'Prénom' });
const save = () => root.root.findByProps({ label: 'OK' });
const color = () => root.root.findByType('colorpicker' as never);
const mount = async () => {
  await act(async () => { root = create(<Nous />); });
  await act(async () => input().props.onChangeText(' Nouveau prénom fictif '));
};
const refresh = async () => { await act(async () => root.update(<Nous />)); };

test.each(['backend', 'member', 'removed', 'unmount'])('les anciens changements de profil sont ignorés après %s', async (kind) => {
  await mount(); const rename = save().props.onPress, recolor = color().props.onChange;
  if (kind === 'backend' || kind === 'member') (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend, userId: kind === 'member' ? 'bob' : 'alice' } });
  else if (kind === 'removed') (useSession as jest.Mock).mockReturnValue({ ...session, members: [] });
  if (kind === 'unmount') await act(async () => root.unmount()); else await refresh();
  await act(async () => { await rename(); await recolor('#222222'); });
  expect(backend.updateMember).not.toHaveBeenCalled();
});

test.each(['name', 'color'])('la modification %s bloque simultanément prénom et couleur', async (kind) => {
  await mount();
  const rename = save().props.onPress, recolor = color().props.onChange, change = input().props.onChangeText;
  let finish!: () => void;
  backend.updateMember.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => {
    pending = kind === 'name' ? rename() : recolor('#222222');
    await rename(); await recolor('#222222'); await change('Trop tard');
  });
  expect(backend.updateMember).toHaveBeenCalledTimes(1);
  expect(input().props).toMatchObject({ value: ' Nouveau prénom fictif ', editable: false });
  expect(save().props.disabled).toBe(true);
  expect(color().props.disabled).toBe(true);
  await act(async () => { finish(); await pending; });
  expect(input().props.editable).toBe(true);
});

test.each(['empty', 'same', 'invalidColor', 'sameColor'])('une valeur %s ne déclenche pas d’écriture', async (kind) => {
  await mount();
  if (kind === 'empty' || kind === 'same') {
    await act(async () => input().props.onChangeText(kind === 'empty' ? '  ' : member.name));
    await act(async () => { await save().props.onPress(); });
  } else await act(async () => { await color().props.onChange(kind === 'sameColor' ? member.color : 'invalid'); });
  expect(backend.updateMember).not.toHaveBeenCalled();
});

test('un échec courant garde le prénom et permet une reprise', async () => {
  await mount(); backend.updateMember.mockRejectedValueOnce(new Error('Échec fictif'));
  await act(async () => { await save().props.onPress(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', 'Échec fictif');
  expect(input().props.value).toBe(' Nouveau prénom fictif ');
  await act(async () => { await save().props.onPress(); });
  expect(backend.updateMember).toHaveBeenLastCalledWith(member.id, { name: 'Nouveau prénom fictif' });
});

test('une ancienne erreur ne perturbe pas le profil courant', async () => {
  await mount();
  let reject!: (error: Error) => void;
  backend.updateMember.mockImplementationOnce(() => new Promise<void>((_, no) => { reject = no; }));
  let pending!: Promise<void>;
  await act(async () => { pending = save().props.onPress(); });
  (useSession as jest.Mock).mockReturnValue({ ...session, backend: { ...backend } });
  await refresh();
  await act(async () => { reject(new Error('Ancien échec')); await pending; });
  expect(showDialog).not.toHaveBeenCalled();
});

test('un prénom mis à jour synchronise un champ intact', async () => {
  await mount();
  await act(async () => input().props.onChangeText(member.name));
  (useSession as jest.Mock).mockReturnValue({ ...session, members: [{ ...member, name: 'Alicia' }] });
  await refresh();
  expect(input().props.value).toBe('Alicia');
  expect(save().props.disabled).toBe(true);
});

test('un prénom mis à jour ne remplace pas le brouillon en cours', async () => {
  await mount();
  (useSession as jest.Mock).mockReturnValue({ ...session, members: [{ ...member, name: 'Alicia' }] });
  await refresh();
  expect(input().props.value).toBe(' Nouveau prénom fictif ');
});
