import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccountCard } from '@/components/account';
import { showDialog } from '@/components/dialog';
import { currentAccount, deleteMyAccount, secureAccount } from '../backend';
import { success } from '../haptics';
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

async function openSecure() {
  await act(async () => button('Annuler').props.onPress());
  await act(async () => button('Sécuriser mon compte').props.onPress());
  await act(async () => {
    button('E-mail').props.onChangeText('alice@example.test');
    button('Mot de passe (6 caractères minimum)').props.onChangeText('fictitious-password');
    button('Confirme le mot de passe').props.onChangeText('fictitious-password');
  });
}

describe.each([false, true])('sécurisation, rendu intermédiaire : %s', rendered => {
  test('les dernières coordonnées et leur confirmation sont prises en compte', async () => {
    await openSecure();
    const submit = button('Sécuriser').props.onPress;
    const change = () => {
      button('E-mail').props.onChangeText('bob@example.test');
      button('Mot de passe (6 caractères minimum)').props.onChangeText('new-fictitious-password');
      button('Confirme le mot de passe').props.onChangeText('new-fictitious-password');
    };
    if (rendered) await act(async () => change());
    await act(async () => { if (!rendered) change(); await submit(); });
    expect(secureAccount).toHaveBeenCalledWith('bob@example.test', 'new-fictitious-password');
  });
  test.each([
    ['E-mail', ''], ['Mot de passe (6 caractères minimum)', 'court'], ['Confirme le mot de passe', 'différent'],
  ])('une ancienne action refuse une valeur devenue invalide : %s', async (field, value) => {
    await openSecure();
    const submit = button('Sécuriser').props.onPress;
    if (rendered) await act(async () => button(field).props.onChangeText(value));
    await act(async () => { if (!rendered) button(field).props.onChangeText(value); await submit(); });
    expect(secureAccount).not.toHaveBeenCalled();
    expect(button(field).props.value).toBe(value);
  });
});

test('les trois coordonnées de sécurisation sont verrouillées pendant la demande', async () => {
  await openSecure();
  const labels = ['E-mail', 'Mot de passe (6 caractères minimum)', 'Confirme le mot de passe'];
  const changes = labels.map(label => button(label).props.onChangeText);
  let finish!: () => void;
  (secureAccount as jest.Mock).mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => {
    pending = button('Sécuriser').props.onPress();
    changes.forEach(change => change('ignored-fictitious-value'));
  });
  const fields = labels.map(label => button(label).props);
  await act(async () => { finish(); await pending; });
  expect(fields.map(field => field.editable)).toEqual([false, false, false]);
  expect(fields.map(field => field.value)).toEqual(['alice@example.test', 'fictitious-password', 'fictitious-password']);
});

test('une fermeture de sécurisation neutralise immédiatement la soumission retenue', async () => {
  await openSecure();
  const submit = button('Sécuriser').props.onPress;
  const close = root.root.findByProps({ title: 'Sécuriser mon compte' }).props.onClose;
  await act(async () => { close(); await submit(); });
  expect(secureAccount).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
});

test('la sécurisation partage un verrou avec la fermeture et les autres soumissions', async () => {
  await openSecure();
  let finish!: () => void;
  (secureAccount as jest.Mock).mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const submit = button('Sécuriser').props.onPress;
  const close = root.root.findByProps({ title: 'Sécuriser mon compte' }).props.onClose;
  let first!: Promise<void>; let second!: Promise<void>;
  await act(async () => { first = submit(); second = submit(); close(); });
  const calls = (secureAccount as jest.Mock).mock.calls.length;
  const open = root.root.findAllByProps({ title: 'Sécuriser mon compte' }).length > 0;
  await act(async () => { finish(); await Promise.all([first, second]); });
  expect(calls).toBe(1);
  expect(open).toBe(true);
});

test.each(['success', 'failure'])('un retour de sécurisation %s après fermeture ne réouvre pas de dialogue', async (result) => {
  await openSecure();
  let finish!: () => void; let reject!: (error: Error) => void;
  (secureAccount as jest.Mock).mockReturnValue(new Promise<void>((yes, no) => { finish = yes; reject = no; }));
  let pending!: Promise<void>;
  await act(async () => { pending = button('Sécuriser').props.onPress(); });
  await act(async () => { root.unmount(); });
  await act(async () => { if (result === 'success') finish(); else reject(new Error('Ancien formulaire')); await pending; });
  expect(showDialog).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
});

test.each([
  ['E-mail', ''], ['Mot de passe (6 caractères minimum)', 'court'], ['Confirme le mot de passe', 'différent'],
])('une soumission directe invalide ne lance pas de sécurisation : %s', async (field, value) => {
  await openSecure();
  await act(async () => button(field).props.onChangeText(value));
  await act(async () => { await button('Sécuriser').props.onPress(); });
  expect(secureAccount).not.toHaveBeenCalled();
});

test('un refus de sécurisation conserve la saisie et permet une reprise volontaire', async () => {
  await openSecure();
  (secureAccount as jest.Mock).mockRejectedValueOnce(new Error('Réseau fictif')).mockResolvedValueOnce(undefined);
  await act(async () => { await button('Sécuriser').props.onPress(); });
  expect(button('E-mail').props.value).toBe('alice@example.test');
  expect(showDialog).toHaveBeenCalledWith('Sécurisation non confirmée', 'Ferme ce formulaire et vérifie l’état de ton compte avant de réessayer : il peut déjà être sécurisé.');
  await act(async () => { await button('Sécuriser').props.onPress(); });
  expect(secureAccount).toHaveBeenCalledTimes(2);
  expect(showDialog).toHaveBeenLastCalledWith('Compte sécurisé', expect.any(String));
});


test('la sécurisation conserve l’explication d’une adresse déjà utilisée', async () => {
  await openSecure();
  const message = 'Cette adresse e-mail est déjà utilisée par un autre compte.';
  (secureAccount as jest.Mock).mockRejectedValueOnce(new Error(message));
  await act(async () => { await button('Sécuriser').props.onPress(); });
  expect(showDialog).toHaveBeenCalledWith('Sécurisation non confirmée', message);
  expect(success).not.toHaveBeenCalled();
  expect(secureAccount).toHaveBeenCalledTimes(1);
});
