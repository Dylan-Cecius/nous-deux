/** Format du code Nous Deux ; espaces et tirets sont tolérés lors de la saisie. */
export function parseInvitationCode(input: string): string | null {
  const code = input.replace(/\s|-/g, '').toUpperCase();
  return /^[A-HJ-NP-Z2-9]{10}$/.test(code) ? code : null;
}
