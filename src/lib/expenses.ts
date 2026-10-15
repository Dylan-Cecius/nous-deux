import type { Expense } from './types';

/**
 * Solde du point de vue de `meId` : positif = l'autre me doit de l'argent.
 * Chaque dépense est partagée à moitié ; un remboursement compte en entier.
 */
export function balanceFor(expenses: Pick<Expense, 'amount' | 'paidBy' | 'kind'>[], meId: string) {
  // Calcul en centimes entiers : les nombres à virgule donneraient 5,154999… au lieu de 5,155.
  let expenseCents = 0;
  let settlementCents = 0;
  for (const e of expenses) {
    const amount = Math.round(e.amount * 100);
    const signed = e.paidBy === meId ? amount : -amount;
    if (e.kind === 'settle') settlementCents += signed;
    else expenseCents += signed;
  }
  // Arrondir le partage net symétriquement : Math.round(-0.5) vaut -0,
  // ce qui donnait deux soldes différents selon le membre qui les consultait.
  const sharedCents = Math.sign(expenseCents) * Math.round(Math.abs(expenseCents) / 2);
  // Les remboursements sont déjà en centimes : les mélanger à un demi-centime
  // avant l’arrondi laisserait un reliquat après remboursement du solde affiché.
  return (sharedCents + settlementCents) / 100;
}
