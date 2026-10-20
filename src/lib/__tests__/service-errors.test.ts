import { authMessage, functionMessage } from '../service-errors';

test.each(['toString', 'constructor', '__proto__'])('un code auth hérité %s ne devient pas un message', (code) => {
  expect(authMessage({ code })).toBe('Une erreur est survenue. Réessaie.');
});

test.each([{}, 42, true])('un message callable non textuel reste générique (%p)', (message) => {
  expect(functionMessage({ code: 'functions/invalid-argument', message })).toBe('Demande impossible pour le moment.');
});

test.each(['auth', 'function'])('un code avec getter fautif est toléré (%s)', (kind) => {
  const error = Object.defineProperty({}, 'code', { get() { throw new Error('secret fictif'); } });
  expect(() => (kind === 'auth' ? authMessage : functionMessage)(error)).not.toThrow();
});

test.each(['functions/internal', 'functions/unavailable', 'functions/private-code'])('le code %s évite la lecture inutile du message', (code) => {
  const message = jest.fn(() => { throw new Error('secret fictif'); });
  const error = Object.defineProperty({ code }, 'message', { get: message });
  expect(typeof functionMessage(error)).toBe('string');
  expect(message).not.toHaveBeenCalled();
});

test('un message callable illisible utilise un repli', () => {
  const error = Object.defineProperty({ code: 'functions/invalid-argument' }, 'message', { get() { throw new Error('secret fictif'); } });
  expect(functionMessage(error)).toBe('Demande impossible pour le moment.');
});

test('les messages connus de connexion restent utiles', () => {
  expect(authMessage({ code: 'auth/invalid-credential' })).toBe('E-mail ou mot de passe incorrect.');
  expect(authMessage({ code: 'auth/network-request-failed' })).toBe('Pas de connexion Internet.');
  expect(authMessage({ code: 'auth/requires-recent-login' })).toContain('reconnecte-toi');
});

test('les messages contrôlés des erreurs métier callable restent compatibles', () => {
  expect(functionMessage({ code: 'functions/invalid-argument', message: 'Invitation invalide.' })).toBe('Invitation invalide.');
  expect(functionMessage({ code: 'functions/not-found', message: 'ne pas exposer' })).toContain('pas encore disponible');
  expect(functionMessage({ code: 'functions/permission-denied', message: '' })).toBe('Demande impossible pour le moment.');
});

test.each([undefined, null, 'texte', 42, Symbol('secret')])('les rejets primitifs restent génériques (%p)', (error) => {
  expect(typeof authMessage(error)).toBe('string');
  expect(typeof functionMessage(error)).toBe('string');
});
