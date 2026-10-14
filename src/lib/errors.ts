/** Messages destinés à l'utilisateur, sans détails techniques du fournisseur. */
export function userError(error: unknown): string {
  const { code = '', message = '' } = (error ?? {}) as { code?: string; message?: string };
  if (['unavailable', 'deadline-exceeded', 'auth/network-request-failed', 'storage/retry-limit-exceeded'].includes(code)) {
    return 'La connexion est interrompue. Vérifie ton réseau, puis réessaie. Ta saisie est conservée.';
  }
  if (code === 'permission-denied' || code === 'storage/unauthorized') {
    return 'Cette modification n’est pas autorisée pour ton compte. Ta saisie est conservée.';
  }
  if (code === 'resource-exhausted') return 'Trop de demandes pour le moment. Réessaie dans quelques minutes.';
  if (!code && message && !message.startsWith('Firebase:')) return message;
  return 'L’opération n’a pas abouti. Réessaie dans un instant. Ta saisie est conservée.';
}
