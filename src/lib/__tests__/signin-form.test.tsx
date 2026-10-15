import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SignInForm } from '@/components/account';
import { showDialog } from '@/components/dialog';
import { resetPassword, signInWithEmail } from '../backend';

jest.mock('../backend', () => ({ signInWithEmail: jest.fn(), resetPassword: jest.fn() }));
jest.mock('../couple-context', () => ({ useCouple: jest.fn(), useSession: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ useTheme: () => ({}) }));
jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react');
  return Object.fromEntries(['Button', 'Card', 'Field', 'Ionicons', 'Row', 'Sheet', 'T'].map((name) => [name, (props: object) => React.createElement(name.toLowerCase(), props)]));
});

let root: ReactTestRenderer;
const onSignedIn = jest.fn(); const onBack = jest.fn();
const backend = { coupleId: 'fictitious' };
const button = (label: string) => root.root.findByProps({ label });
beforeEach(async () => {
  await act(async () => { root = create(<SignInForm onSignedIn={onSignedIn} onBack={onBack} />); });
  await act(async () => {
    button('E-mail').props.onChangeText('alice@example.test');
    button('Mot de passe').props.onChangeText('fictitious-password');
  });
});
afterEach(async () => { await act(async () => { root.unmount(); }); jest.resetAllMocks(); });

test.each(['signin', 'reset'])('le verrou %s empêche une autre action et le retour dans le même tour', async (first) => {
  let finish!: (value: unknown) => void;
  const pending = new Promise((resolve) => { finish = resolve; });
  (signInWithEmail as jest.Mock).mockReturnValue(first === 'signin' ? pending : Promise.resolve(backend));
  (resetPassword as jest.Mock).mockReturnValue(first === 'reset' ? pending : Promise.resolve());
  const start = button(first === 'signin' ? 'Me connecter' : 'Mot de passe oublié ?').props.onPress;
  const other = button(first === 'signin' ? 'Mot de passe oublié ?' : 'Me connecter').props.onPress;
  const back = button('Retour').props.onPress;
  await act(async () => { void start(); void other(); void back(); });
  const counts = [(signInWithEmail as jest.Mock).mock.calls.length, (resetPassword as jest.Mock).mock.calls.length, onBack.mock.calls.length];
  const backDisabled = button('Retour').props.disabled;
  await act(async () => { finish(backend); await pending; });
  expect(backDisabled).toBe(true);
  expect(counts).toEqual(first === 'signin' ? [1, 0, 0] : [0, 1, 0]);
});

test('deux soumissions simultanées ne lancent qu’une connexion', async () => {
  let finish!: (value: unknown) => void;
  const pending = new Promise((resolve) => { finish = resolve; });
  (signInWithEmail as jest.Mock).mockReturnValue(pending);
  const submit = button('Me connecter').props.onPress;
  await act(async () => { void submit(); void submit(); });
  const calls = (signInWithEmail as jest.Mock).mock.calls.length;
  await act(async () => { finish(backend); await pending; });
  expect(calls).toBe(1);
  expect(onSignedIn).toHaveBeenCalledTimes(1);
});

test.each([['signin', 'success'], ['signin', 'failure'], ['reset', 'success'], ['reset', 'failure']])(
  'un résultat %s/%s n’agit plus après fermeture du formulaire', async (action, result) => {
    let resolve!: (value: unknown) => void; let reject!: (error: Error) => void;
    const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
    ((action === 'signin' ? signInWithEmail : resetPassword) as jest.Mock).mockReturnValue(pending);
    let submission!: Promise<void>;
    await act(async () => { submission = button(action === 'signin' ? 'Me connecter' : 'Mot de passe oublié ?').props.onPress(); });
    await act(async () => { root.unmount(); });
    await act(async () => { if (result === 'success') resolve(backend); else reject(new Error('Ancienne demande')); await submission; });
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(showDialog).not.toHaveBeenCalled();
  },
);

test('un échec conserve les champs et permet une nouvelle tentative volontaire', async () => {
  (signInWithEmail as jest.Mock).mockRejectedValueOnce(new Error('Connexion fictive refusée')).mockResolvedValueOnce(backend);
  await act(async () => { await button('Me connecter').props.onPress(); });
  expect(showDialog).toHaveBeenCalledWith('Connexion impossible', 'Connexion fictive refusée');
  expect(button('E-mail').props.value).toBe('alice@example.test');
  expect(button('Mot de passe').props.value).toBe('fictitious-password');
  await act(async () => { await button('Me connecter').props.onPress(); });
  expect(onSignedIn).toHaveBeenCalledWith(backend);
});

test('la réinitialisation sans adresse valide ne fait aucun envoi', async () => {
  await act(async () => { button('E-mail').props.onChangeText(''); });
  await act(async () => { await button('Mot de passe oublié ?').props.onPress(); });
  expect(resetPassword).not.toHaveBeenCalled();
  expect(showDialog).toHaveBeenCalledWith('Mot de passe oublié', 'Entre d’abord ton adresse e-mail.');
});
