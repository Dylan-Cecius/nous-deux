import type { Expense } from './types';

/**
 * Solde du point de vue de `meId` : positif = l'autre me doit de l'argent.
 * Chaque dépense est partagée à moitié ; un remboursement compte en entier.
 */
export function balanceFor(expenses: Pick<Expense, 'amount' | 'paidBy' | 'kind'>[], meId: string) {
  // Calcul en centimes entiers : les nombres à virgule donneraient 5,154999… au lieu de 5,155.
  let cents = 0;
  for (const e of expenses) {
    const amount = Math.round(e.amount * 100);
    const share = e.kind === 'settle' ? amount : amount / 2;
    cents += e.paidBy === meId ? share : -share;
  }
  return Math.round(cents) / 100;
}
