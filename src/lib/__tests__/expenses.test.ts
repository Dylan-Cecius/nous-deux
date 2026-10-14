/// <reference types="jest" />
import { balanceFor } from '../expenses';

const ME = 'dylan';
const PARTNER = 'camille';

describe('dépenses communes', () => {
  test('une dépense est partagée à moitié', () => {
    const expenses = [{ amount: 50, paidBy: ME, kind: 'expense' as const }];
    expect(balanceFor(expenses, ME)).toBe(25); // ma moitié me doit 25 €
    expect(balanceFor(expenses, PARTNER)).toBe(-25); // vu de son côté : elle doit 25 €
  });

  test('les dépenses de chacun se compensent', () => {
    const expenses = [
      { amount: 60, paidBy: ME, kind: 'expense' as const },
      { amount: 20, paidBy: PARTNER, kind: 'expense' as const },
    ];
    expect(balanceFor(expenses, ME)).toBe(20);
  });

  test('un remboursement remet le solde à zéro', () => {
    const expenses = [
      { amount: 50, paidBy: ME, kind: 'expense' as const },
      { amount: 25, paidBy: PARTNER, kind: 'settle' as const },
    ];
    expect(balanceFor(expenses, ME)).toBe(0);
    expect(balanceFor(expenses, PARTNER)).toBe(0);
  });

  test('les centimes sont arrondis proprement', () => {
    const expenses = [
      { amount: 10.01, paidBy: ME },
      { amount: 0.1, paidBy: ME },
      { amount: 0.2, paidBy: ME },
    ];
    expect(balanceFor(expenses, ME)).toBe(5.16);
  });
});
