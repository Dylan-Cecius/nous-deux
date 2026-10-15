import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccountCard } from '@/components/account';
import { showDialog } from '@/components/dialog';
import { currentAccount, deleteMyAccount } from '../backend';
import { useCouple, useSession } from '../couple-context';

jest.mock('../backend', () => ({ currentAccount: jest.fn(), deleteMyAccount: jest.fn(), secureAccount: jest.fn() }));
jest.mock('../couple-context', () => ({ useCouple: jest.fn(), useSession: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}) }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Button', 'Card', 'Field', 'Ionicons', 'Row', 'Sheet', 'T'].map((name) => [name, (props: object) => React.createElement(name.toLowerCase(), props)]));
});

let root: ReactTestRenderer;
const backend = { mode: 'cloud', coupleId: 'couple', userId: 'alice' };
const nextBackend = { mode: 'cloud', coupleId: 'other', userId: 'bob' };
const signOut = jest.fn(); const completeDeletion = jest.fn();
const button = (label: string) => root.root.findByProps({ label });
beforeEach(async () => {
  (useSession as jest.Mock).mockReturnValue({ backend });
  (useCouple as jest.Mock).mockReturnValue({ signOut, completeDeletion });
  (currentAccount as jest.Mock).mockReturnValue({ anonymous: true, email: null });
  (deleteMyAccount as jest.Mock).mockResolvedValue('complete');
  completeDeletion.mockReturnValue(true);
  await act(async () => { root = create(<AccountCard />); });
  await act(async () => button('Supprimer mon compte').props.onPress());
});
afterEach(async () => { await act(async () => root.unmount()); jest.resetAllMocks(); });

test.each(['complete', 'pending'])('une suppression %s termine l’interface sans seconde déconnexion', async (status) => {
  (deleteMyAccount as jest.Mock).mockResolvedValue(status);
  await act(async () => { await button('Supprimer définitivement').props.onPress(); });
  expect(completeDeletion).toHaveBeenCalledWith(backend);
  expect(signOut).not.toHaveBeenCalled();
  expect(showDialog).toHaveBeenCalledTimes(status === 'pending' ? 1 : 0);
});

test('un double appel direct à la suppression ne relance pas le service', async () => {
  let finish!: (value: string) => void;
  (deleteMyAccount as jest.Mock).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const submit = button('Supprimer définitivement').props.onPress;
  let one!: Promise<void>; let two!: Promise<void>;
  await act(async () => { one = submit(); two = submit(); });
  const count = (deleteMyAccount as jest.Mock).mock.calls.length;
  await act(async () => { finish('complete'); await Promise.all([one, two]); });
  expect(count).toBe(1);
});

test.each(['unmount', 'backend'])('un retour de suppression après %s ne touche pas une autre interface', async (change) => {
  let finish!: (value: string) => void;
  (deleteMyAccount as jest.Mock).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Supprimer définitivement').props.onPress(); });
  await act(async () => {
    if (change === 'unmount') root.unmount();
    else { (useSession as jest.Mock).mockReturnValue({ backend: nextBackend }); root.update(<AccountCard />); }
  });
  await act(async () => { finish('pending'); await pending; });
  expect(completeDeletion).toHaveBeenCalledWith(backend);
  expect(signOut).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});

test('changer de membre ferme la confirmation et ne conserve pas le mot de passe', async () => {
  (currentAccount as jest.Mock).mockReturnValue({ anonymous: false, email: 'alice@example.test' });
  await act(async () => { root.update(<AccountCard />); });
  await act(async () => button('Confirme ton mot de passe').props.onChangeText('fictitious-password'));
  await act(async () => { (useSession as jest.Mock).mockReturnValue({ backend: nextBackend }); root.update(<AccountCard />); });
  expect(root.root.findAllByProps({ label: 'Supprimer définitivement' })).toHaveLength(0);
  await act(async () => button('Supprimer mon compte').props.onPress());
  expect(button('Confirme ton mot de passe').props.value).toBe('');
});

test('une erreur de suppression reste visible et peut être réessayée', async () => {
  (deleteMyAccount as jest.Mock).mockRejectedValueOnce(new Error('Service fictif indisponible'));
  await act(async () => { await button('Supprimer définitivement').props.onPress(); });
  expect(JSON.stringify(root.toJSON())).toContain('Service fictif indisponible');
  expect(completeDeletion).not.toHaveBeenCalled();
  await act(async () => { await button('Supprimer définitivement').props.onPress(); });
  expect(completeDeletion).toHaveBeenCalledWith(backend);
});
