import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SignInForm } from '@/components/account';
import { showDialog } from '@/components/dialog';
import { resetPassword, signInWithEmail } from '../backend';

jest.mock('../backend', () => ({ signInWithEmail: jest.fn(), resetPassword: jest.fn() }));
jest.mock('../couple-context', () => ({ useCouple: jest.fn(), useSession: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
let mockFocus = () => {};
let mockBlur = () => {};
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => (() => void) | void) => {
  const React = jest.requireActual('react');
  React.useEffect(() => {
    mockFocus = () => { const cleanup = effect(); mockBlur = cleanup ?? (() => {}); };
    mockFocus();
    return () => mockBlur();
  }, [effect]);
} }));
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
  mockFocus = mockBlur = () => {};
  await act(async () => { root = create(<SignInForm onSignedIn={onSignedIn} onBack={onBack} />); });
  await act(async () => {
    button('E-mail').props.onChangeText('alice@example.test');
    button('Mot de passe').props.onChangeText('fictitious-password');
  });
});
afterEach(async () => { await act(async () => { root.unmount(); }); jest.resetAllMocks(); });

describe.each([false, true])('connexion, rendu intermédiaire : %s', rendered => {
  test.each(['signin', 'reset'])('l’action %s utilise les coordonnées actuellement saisies', async action => {
    const submit = button(action === 'signin' ? 'Me connecter' : 'Mot de passe oublié ?').props.onPress;
    const change = () => {
      button('E-mail').props.onChangeText('bob@example.test');
      button('Mot de passe').props.onChangeText('new-fictitious-password');
    };
    if (rendered) await act(async () => change());
    await act(async () => { if (!rendered) change(); await submit(); });
    if (action === 'signin') expect(signInWithEmail).toHaveBeenCalledWith('bob@example.test', 'new-fictitious-password');
    else expect(resetPassword).toHaveBeenCalledWith('bob@example.test');
  });
  test.each(['signin', 'reset'])('l’action %s ne réutilise pas l’adresse effacée', async action => {
    const submit = button(action === 'signin' ? 'Me connecter' : 'Mot de passe oublié ?').props.onPress;
    if (rendered) await act(async () => button('E-mail').props.onChangeText(''));
    await act(async () => { if (!rendered) button('E-mail').props.onChangeText(''); await submit(); });
    expect(signInWithEmail).not.toHaveBeenCalled();
    expect(resetPassword).not.toHaveBeenCalled();
  });
});

test.each(['signin', 'reset'])('la demande %s bloque les coordonnées jusqu’à sa réponse', async action => {
  let finish!: (value: unknown) => void;
  const deferred = new Promise(resolve => { finish = resolve; });
  ((action === 'signin' ? signInWithEmail : resetPassword) as jest.Mock).mockReturnValueOnce(deferred);
  const email = button('E-mail').props.onChangeText, password = button('Mot de passe').props.onChangeText;
  let pending!: Promise<void>;
  await act(async () => {
    pending = button(action === 'signin' ? 'Me connecter' : 'Mot de passe oublié ?').props.onPress();
    email('ignored@example.test'); password('ignored-fictitious-password');
  });
  const fields = [button('E-mail').props, button('Mot de passe').props];
  await act(async () => { finish(backend); await pending; });
  expect(fields.map(field => field.editable)).toEqual([false, false]);
  expect(fields.map(field => field.value)).toEqual(['alice@example.test', 'fictitious-password']);
  expect(button('E-mail').props.editable).toBe(true);
});

test.each(['signin', 'reset'])('le retour neutralise immédiatement une ancienne action %s', async action => {
  const submit = button(action === 'signin' ? 'Me connecter' : 'Mot de passe oublié ?').props.onPress;
  const back = button('Retour').props.onPress;
  await act(async () => { await back(); await submit(); await back(); });
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(signInWithEmail).not.toHaveBeenCalled();
  expect(resetPassword).not.toHaveBeenCalled();
});

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

describe.each([false, true])('départ vers l’aide, retour avant résultat : %s', returned => {
  test.each([['signin', 'success'], ['signin', 'failure'], ['reset', 'success'], ['reset', 'failure']])(
    'le résultat %s/%s ne s’affiche pas après départ de la route', async (action, outcome) => {
      let finish!: () => void;
      ((action === 'signin' ? signInWithEmail : resetPassword) as jest.Mock).mockReturnValueOnce(new Promise((resolve, reject) => {
        finish = () => outcome === 'success' ? resolve(backend) : reject(new Error('Résultat hors écran fictif'));
      }));
      let pending!: Promise<void>;
      await act(async () => { pending = button(action === 'signin' ? 'Me connecter' : 'Mot de passe oublié ?').props.onPress(); });
      await act(async () => { mockBlur(); if (returned) mockFocus(); });
      await act(async () => { finish(); await pending; });
      expect(onSignedIn).not.toHaveBeenCalled();
      expect(showDialog).not.toHaveBeenCalled();
    },
  );
});

test('les événements hors écran ne modifient ni coordonnées ni navigation', async () => {
  const email = button('E-mail').props.onChangeText;
  const password = button('Mot de passe').props.onChangeText;
  const back = button('Retour').props.onPress;
  await act(async () => { mockBlur(); email('absent@example.test'); password('absent-fictitious'); await back(); });
  expect(button('E-mail').props.value).toBe('alice@example.test');
  expect(button('Mot de passe').props.value).toBe('fictitious-password');
  expect(onBack).not.toHaveBeenCalled();
});

test.each(['Me connecter', 'Mot de passe oublié ?'])('%s ne démarre pas hors écran', async label => {
  const submit = button(label).props.onPress;
  await act(async () => { mockBlur(); await submit(); });
  expect(signInWithEmail).not.toHaveBeenCalled();
  expect(resetPassword).not.toHaveBeenCalled();
});

test('le retour de l’aide conserve le brouillon et permet une nouvelle connexion volontaire', async () => {
  (signInWithEmail as jest.Mock).mockResolvedValueOnce(backend);
  await act(async () => { mockBlur(); mockFocus(); });
  await act(async () => { await button('Me connecter').props.onPress(); });
  expect(signInWithEmail).toHaveBeenCalledWith('alice@example.test', 'fictitious-password');
  expect(onSignedIn).toHaveBeenCalledWith(backend);
});
