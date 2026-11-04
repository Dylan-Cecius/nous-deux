import { accountErrorMessage } from '../account-errors';

test.each([
  [{ code: 'auth/invalid-credential', message: 'private fictitious password' }, 'E-mail ou mot de passe incorrect.'],
  [new Error('Cette adresse e-mail est déjà utilisée par un autre compte.'), 'Cette adresse e-mail est déjà utilisée par un autre compte.'],
  [new Error('Ce compte n’est relié à aucun espace de couple.'), 'Ce compte n’est relié à aucun espace de couple.'],
  [new Error('Le compte a changé. Rouvre la connexion avant de réessayer.'), 'Le compte a changé. Rouvre la connexion avant de réessayer.'],
])('une explication publique connue est conservée : %j', (error, expected) => {
  expect(accountErrorMessage(error)).toBe(expected);
});

test.each([
  new Error('storage path: private-fictitious-session'),
  'private fictitious token', null, undefined,
  { code: '__proto__', message: 'private fictitious identity' },
  { message: 'E-mail ou mot de passe incorrect. private fictitious password' },
  { get message() { throw new Error('private fictitious getter'); } },
  new Proxy({}, { get() { throw new Error('private fictitious proxy'); } }),
])('un rejet inconnu ou illisible utilise le repli sans conversion : %#', error => {
  expect(accountErrorMessage(error)).toBeNull();
});

test('un code reconnu ne lit pas un message technique inaccessible', () => {
  const error = { code: 'auth/invalid-email', get message() { throw new Error('private fictitious getter'); } };
  expect(accountErrorMessage(error)).toBe('Cette adresse e-mail n’est pas valide.');
});
