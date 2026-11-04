import { accountErrorMessage } from './account-errors';
import { functionMessage } from './service-errors';

const publicMessages = new Set([
  'Renseigne ton prénom avant de continuer.',
  'Renseigne le prénom de ta moitié.',
  'Vérifie le code d’invitation de 10 caractères fourni dans Nous Deux. Les lettres I et O et les chiffres 0 et 1 n’en font pas partie.',
  'L’ouverture de votre espace sur ce téléphone n’a pas pu être confirmée. Réessaie dans un instant. Ta saisie est conservée.',
  'Les informations envoyées ne sont pas valides.',
  'Connecte-toi pour continuer.',
  'La suppression de ce compte est en cours.',
  'Accès refusé.',
  'Cet espace est temporairement indisponible pendant une suppression.',
  'Limite atteinte. Réessaie plus tard.',
  'Tu as déjà un espace. Reconnecte-toi pour le retrouver.',
  'Une invitation est possible uniquement lorsque tu es seul dans cet espace.',
  'Invitation invalide, expirée ou déjà utilisée. Demande un nouveau code à ta moitié.',
  'Ce compte est déjà lié à un espace.',
  'La réponse du serveur est incomplète. Réessaie pour retrouver ton espace.',
  functionMessage({ code: 'functions/not-found' }),
  functionMessage({ code: 'functions/unavailable' }),
]);

/** Public validation/recovery diagnostics only; never forward a private rejection. */
export function entryErrorMessage(error: unknown): string | null {
  const account = accountErrorMessage(error);
  if (account) return account;
  try {
    const failure = error as { code?: unknown; message?: unknown } | null;
    const code = failure?.code;
    if (typeof code === 'string' && ['unavailable', 'deadline-exceeded', 'functions/unavailable', 'functions/deadline-exceeded'].includes(code)) {
      return functionMessage({ code: 'functions/unavailable' });
    }
    const message = failure?.message;
    return typeof message === 'string' && publicMessages.has(message) ? message : null;
  } catch {
    return null;
  }
}
