// Formatting only: no SDK, authentication change or remote call in this module.
function errorCode(error: unknown): string {
  try {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' ? code : '';
  } catch {
    return '';
  }
}

function businessMessage(error: unknown): string {
  try {
    const message = (error as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && message) return message;
  } catch {
    // A malformed rejection must not cause another failure while reporting it.
  }
  return 'Demande impossible pour le moment.';
}

/** Keep business messages only for the existing explicit callable-code list. */
export function functionMessage(e: unknown): string {
  const code = errorCode(e);
  switch (code) {
    case 'functions/not-found':
      return 'Cette fonction n’est pas encore disponible. Réessaie après la mise à jour du service.';
    case 'functions/internal':
      return 'L’opération n’a pas abouti. Réessaie dans un instant.';
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return 'Le service ne répond pas pour le moment. Vérifie ta connexion et réessaie.';
    case 'functions/failed-precondition':
    case 'functions/already-exists':
    case 'functions/unauthenticated':
    case 'functions/resource-exhausted':
    case 'functions/invalid-argument':
    case 'functions/permission-denied':
      return businessMessage(e);
    default:
      return 'Une erreur est survenue. Réessaie dans un instant.';
  }
}

export function authMessage(e: unknown): string {
  const code = errorCode(e);
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Cette adresse e-mail est déjà utilisée par un autre compte.',
    'auth/invalid-email': 'Cette adresse e-mail n’est pas valide.',
    'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
    'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
    'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cette adresse e-mail.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.',
    'auth/network-request-failed': 'Pas de connexion Internet.',
    'auth/requires-recent-login': 'Par sécurité, déconnecte-toi puis reconnecte-toi avant de supprimer ton compte.',
  };
  return Object.hasOwn(messages, code) ? messages[code] : 'Une erreur est survenue. Réessaie.';
}
