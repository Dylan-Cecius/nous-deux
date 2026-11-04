const GENERIC_ERROR = 'L’opération n’a pas abouti. Réessaie dans un instant. Ta saisie est conservée.';

/** Translate provider codes defensively. Legacy code-free business messages
 * remain supported; callers handling private data should use fixed messages.
 */
export function userError(error: unknown): string {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) return GENERIC_ERROR;
  try {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && ['unavailable', 'deadline-exceeded', 'auth/network-request-failed', 'storage/retry-limit-exceeded'].includes(code)) {
      return 'La connexion est interrompue. Vérifie ton réseau, puis réessaie. Ta saisie est conservée.';
    }
    if (code === 'permission-denied' || code === 'storage/unauthorized') {
      return 'Cette modification n’est pas autorisée pour ton compte. Ta saisie est conservée.';
    }
    if (code === 'resource-exhausted') return 'Trop de demandes pour le moment. Réessaie dans quelques minutes.';
    if (code !== undefined && code !== '') return GENERIC_ERROR;
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message && !message.startsWith('Firebase:')) return message;
  } catch {
    // Rejected values can contain throwing getters/proxies. Reporting the error
    // must not throw again, inspect it further or include it in the fallback.
  }
  return GENERIC_ERROR;
}
