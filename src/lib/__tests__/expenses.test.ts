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

  test.each([0.01, 0.03, 10.01, 10.31, 99999.99])('le partage de %s donne deux soldes opposés', (amount) => {
    const expenses = [{ amount, paidBy: ME, kind: 'expense' as const }];
    expect(balanceFor(expenses, ME)).toBe(-balanceFor(expenses, PARTNER));
  });

  test.each([ME, PARTNER])('un remboursement du solde impair remet les deux vues à zéro, payeur %s', (payer) => {
    const other = payer === ME ? PARTNER : ME;
    const expenses = [{ amount: 10.31, paidBy: payer, kind: 'expense' as const }];
    const settlement = { amount: balanceFor(expenses, payer), paidBy: other, kind: 'settle' as const };
    expect(settlement.amount).toBe(5.16);
    expect(balanceFor([...expenses, settlement], payer)).toBe(0);
    expect(balanceFor([...expenses, settlement], other)).toBe(0);
  });

  test('les demi-centimes sont cumulés avant l’arrondi, pas majorés pour chaque ligne', () => {
    const expenses = [
      { amount: 0.01, paidBy: ME },
      { amount: 0.01, paidBy: ME },
      { amount: 0.01, paidBy: ME },
    ];
    expect(balanceFor(expenses, ME)).toBe(0.02);
    expect(balanceFor(expenses, PARTNER)).toBe(-0.02);
  });

  test('les remboursements sont appliqués en centimes entiers après le partage', () => {
    const expenses = [
      { amount: 10.31, paidBy: ME, kind: 'expense' as const },
      { amount: 2, paidBy: PARTNER, kind: 'settle' as const },
      { amount: 3.16, paidBy: PARTNER, kind: 'settle' as const },
    ];
    expect(balanceFor(expenses, ME)).toBe(0);
    expect(balanceFor(expenses, PARTNER)).toBe(0);
    expect(balanceFor([...expenses].reverse(), ME)).toBe(0);
  });

  test('deux dépenses impaires opposées se compensent sans solde négatif zéro', () => {
    const expenses = [{ amount: 0.01, paidBy: ME }, { amount: 0.01, paidBy: PARTNER }];
    expect(Object.is(balanceFor(expenses, ME), 0)).toBe(true);
    expect(Object.is(balanceFor(expenses, PARTNER), 0)).toBe(true);
  });
});
