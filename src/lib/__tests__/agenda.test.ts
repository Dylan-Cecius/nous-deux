/// <reference types="jest" />
import { endMin, freeSlots, fromMin, mondayOf, toMin } from '../agenda';

const slot = (start: string, end: string) => ({ start, end });
const readable = (slots: [number, number][]) => slots.map(([s, e]) => `${fromMin(s)}-${fromMin(e)}`);

describe('agenda', () => {
  test('conversion heures ↔ minutes', () => {
    expect(toMin('09:30')).toBe(570);
    expect(fromMin(570)).toBe('9:30');
  });

  test('un horaire de nuit est coupé à minuit', () => {
    expect(endMin(slot('22:00', '06:00'))).toBe(24 * 60);
    expect(endMin(slot('09:00', '17:00'))).toBe(17 * 60);
  });

  test('libres tous les deux : boulot 9h-17h et garde 14h-20h → 8h-9h et 20h-23h', () => {
    expect(readable(freeSlots([slot('09:00', '17:00'), slot('14:00', '20:00')]))).toEqual(['8:00-9:00', '20:00-23:00']);
  });

  test('journée vide → toute la plage 8h-23h', () => {
    expect(readable(freeSlots([]))).toEqual(['8:00-23:00']);
  });

  test('les créneaux de moins d’une heure sont ignorés', () => {
    expect(readable(freeSlots([slot('08:00', '12:00'), slot('12:30', '22:30')]))).toEqual([]);
  });

  test('l’ordre des horaires n’a pas d’importance', () => {
    const a = freeSlots([slot('18:00', '19:00'), slot('09:00', '10:00')]);
    const b = freeSlots([slot('09:00', '10:00'), slot('18:00', '19:00')]);
    expect(a).toEqual(b);
    expect(readable(a)).toEqual(['8:00-9:00', '10:00-18:00', '19:00-23:00']);
  });

  test('mondayOf renvoie le lundi de la semaine', () => {
    expect(mondayOf('2026-10-14')).toBe('2026-10-12'); // mercredi → lundi
    expect(mondayOf('2026-10-18')).toBe('2026-10-12'); // dimanche → lundi précédent
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
  });
});
