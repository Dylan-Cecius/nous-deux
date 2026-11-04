import { functionMessage } from './service-errors';

// Explicit public diagnostics emitted by the current settlement endpoint.
// Never echo arbitrary storage errors, which can include the private ledger.
const publicMessages = new Set([
  'Le relevé a changé. Attends son actualisation avant de marquer le remboursement.',
  'Le compte a changé. Rouvre les dépenses avant de réessayer.',
  'Deux membres sont nécessaires pour marquer un remboursement.',
  'Ce relevé est trop volumineux pour cette opération.',
  'Ce relevé contient une dépense qui ne peut pas être soldée automatiquement.',
  'Ce solde ne peut pas être marqué comme remboursé.',
  'Les informations envoyées ne sont pas valides.',
  'Connecte-toi pour continuer.',
  'La suppression de ce compte est en cours.',
  'Accès refusé.',
  'Cet espace est temporairement indisponible pendant une suppression.',
  'Limite atteinte. Réessaie plus tard.',
  'La confirmation du remboursement n’a pas pu être vérifiée. Réessaie pour retrouver le résultat de cette même demande.',
  functionMessage({ code: 'functions/not-found' }),
]);

export function settlementErrorMessage(error: unknown): string {
  try {
    const message = (error as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && publicMessages.has(message)) return message;
  } catch {
    // Reporting malformed provider rejections must not itself throw.
  }
  return 'Vérifie l’historique après son actualisation avant de réessayer : la marque peut déjà avoir été enregistrée.';
}
