/// <reference types="jest" />
import { drawRitual, filterRituals, RITUALS } from '../rituals';

describe('rituels à deux', () => {
  test('un accès gratuit ne dévoile aucune idée Plus, même avec des filtres', () => {
    const free = filterRituals();
    expect(free.length).toBeGreaterThanOrEqual(12);
    expect(free.every((idea) => !idea.premium)).toBe(true);
    expect(filterRituals({ setting: 'maison', maxMinutes: 30 }).every((idea) => !idea.premium)).toBe(true);
    expect(filterRituals({}, true)).toHaveLength(RITUALS.length);
  });

  test('budget, lieu et temps se combinent sans contourner l’accès', () => {
    const results = filterRituals({ budget: 'gratuit', setting: 'maison', maxMinutes: 20 }, true);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((idea) => idea.budget === 'gratuit' && idea.setting === 'maison' && idea.minutes <= 20)).toBe(true);
    expect(filterRituals({ maxMinutes: 0 }, true)).toEqual([]);
  });

  test('un tirage vide est explicite et le tirage suivant évite la répétition', () => {
    const free = filterRituals();
    expect(drawRitual([])).toBeNull();
    expect(drawRitual([free[0]], free[0].id)).toBe(free[0]);
    expect(drawRitual(free, free[0].id, () => 0)).toBe(free[1]);
    expect(drawRitual(free, undefined, () => 0)).toBe(free[0]);
    expect(drawRitual(free, undefined, () => 0.9999)).toBe(free[free.length - 1]);
  });

  test('une révocation de Plus retire immédiatement les résultats premium', () => {
    const paid = filterRituals({}, true).find((idea) => idea.premium)!;
    expect(filterRituals().some((idea) => idea.id === paid.id)).toBe(false);
  });
});
