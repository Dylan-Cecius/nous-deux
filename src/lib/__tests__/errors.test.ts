import { userError } from '../errors';

const generic = 'L’opération n’a pas abouti. Réessaie dans un instant. Ta saisie est conservée.';

test.each([42, true, {}, ['message']])('un message non textuel utilise le repli (%p)', (message) => {
  expect(userError({ message })).toBe(generic);
});

test.each(['code', 'message'])('une propriété %s fautive ne provoque pas de seconde erreur', (property) => {
  const error = Object.defineProperty({}, property, { get() { throw new Error('Valeur privée fictive'); } });
  expect(userError(error)).toBe(generic);
});

test('un code inconnu n’inspecte pas le message fournisseur', () => {
  const message = jest.fn(() => { throw new Error('Ne pas lire'); });
  const error = Object.defineProperty({ code: 'provider/private-code' }, 'message', { get: message });
  expect(userError(error)).toBe(generic);
  expect(message).not.toHaveBeenCalled();
});

test('un code connu peut être traduit sans lire le message fournisseur', () => {
  const message = jest.fn(() => { throw new Error('Ne pas lire'); });
  const error = Object.defineProperty({ code: 'permission-denied' }, 'message', { get: message });
  expect(userError(error)).toContain('n’est pas autorisée');
  expect(message).not.toHaveBeenCalled();
});

test.each([undefined, null, 'texte brut', 42, false, Symbol('private')])('une valeur de rejet primitive reste générique (%p)', (error) => {
  expect(userError(error)).toBe(generic);
});

test.each(['unavailable', 'deadline-exceeded', 'auth/network-request-failed', 'storage/retry-limit-exceeded'])('le code réseau %s reste traduit', (code) => {
  expect(userError({ code, message: 'private-token' })).toContain('connexion est interrompue');
});

test('les messages métier historiques sans code restent compatibles', () => {
  expect(userError(new Error('Choisis entre 1 et 52 horaires.'))).toBe('Choisis entre 1 et 52 horaires.');
  expect(userError(new Error('Firebase: private-token'))).toBe(generic);
  expect(userError({ code: 'resource-exhausted' })).toContain('Trop de demandes');
});
