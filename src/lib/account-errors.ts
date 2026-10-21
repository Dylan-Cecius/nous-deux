import { authMessage } from './service-errors';

// Display boundary only. Never stringify arbitrary SDK/storage failures.
const authCodes = new Set([
  'auth/email-already-in-use', 'auth/invalid-email', 'auth/weak-password',
  'auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found',
  'auth/too-many-requests', 'auth/network-request-failed',
]);
const publicMessages = new Set([
  ...Array.from(authCodes, code => authMessage({ code })),
  'Aucun compte sur ce téléphone.',
  'Le compte a changé. Rouvre le formulaire avant de réessayer.',
  'Le compte a changé. Rouvre la connexion avant de réessayer.',
  'Ce compte n’est relié à aucun espace de couple.',
  'Ton compte n’a plus accès à cet espace. Contacte l’assistance si cela te semble anormal.',
  'Impossible de retrouver votre espace pour le moment. Vérifie ta connexion et réessaie.',
  'Le rattachement de ce compte est illisible. Réessaie ou contacte l’assistance.',
  'La liste des membres de cet espace est illisible. Réessaie ou contacte l’assistance.',
]);

/** Preserve only known public auth/recovery messages; the form supplies its fallback. */
export function accountErrorMessage(error: unknown): string | null {
  try {
    const failure = error as { code?: unknown; message?: unknown } | null;
    const code = failure?.code;
    if (typeof code === 'string' && authCodes.has(code)) return authMessage({ code });
    const message = failure?.message;
    return typeof message === 'string' && publicMessages.has(message) ? message : null;
  } catch {
    return null;
  }
}
