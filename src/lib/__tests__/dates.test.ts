/// <reference types="jest" />
import {
  addDays,
  daysBetween,
  formatNumber,
  nextMilestone,
  nextOccurrence,
  parseFrenchDate,
  parseTime,
  quote,
  toFrenchDate,
} from '../dates';

describe('dates', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 14, 12, 0)); // 14 octobre 2026
  });
  afterAll(() => jest.useRealTimers());

  test('addDays traverse les mois et les années', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('daysBetween compte les jours entiers, même au changement d’heure', () => {
    expect(daysBetween('2026-09-03', '2026-10-14')).toBe(41);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // passage à l’heure d’été
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0);
  });

  test('nextOccurrence : anniversaire déjà passé cette année → l’an prochain', () => {
    expect(nextOccurrence('2020-02-14', true)).toBe('2027-02-14');
    expect(nextOccurrence('2020-11-30', true)).toBe('2026-11-30');
    expect(nextOccurrence('2020-10-14', true)).toBe('2026-10-14'); // c'est aujourd'hui
    expect(nextOccurrence('2027-07-01', false)).toBe('2027-07-01');
  });

  test('nextMilestone : caps de 100 jours, puis de 500', () => {
    expect(nextMilestone(41)).toEqual({ next: 100, left: 59, progress: 0.41 });
    expect(nextMilestone(1337)).toEqual({ next: 1500, left: 163, progress: 337 / 500 });
    expect(nextMilestone(100).next).toBe(200);
  });

  test('parseFrenchDate accepte JJ/MM/AAAA et refuse les dates impossibles', () => {
    expect(parseFrenchDate('14/02/2023')).toBe('2023-02-14');
    expect(parseFrenchDate('3/9/2026')).toBe('2026-09-03');
    expect(parseFrenchDate('31/02/2026')).toBeNull();
    expect(parseFrenchDate('demain')).toBeNull();
    expect(toFrenchDate('2023-02-14')).toBe('14/02/2023');
  });

  test('parseTime comprend 9h, 930, 18:45', () => {
    expect(parseTime('9h')).toBe('09:00');
    expect(parseTime('930')).toBe('09:30');
    expect(parseTime('18:45')).toBe('18:45');
    expect(parseTime('25:00')).toBeNull();
  });

  test('formatNumber et quote utilisent des espaces insécables', () => {
    expect(formatNumber(1337)).toBe('1 337');
    expect(quote('Je t’aime')).toBe('« Je t’aime »');
  });
});
