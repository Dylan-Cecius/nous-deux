import { newScheduleSlots, parseSchedule } from '../schedule-import';
import type { AgendaEvent } from '../types';

const reference = '2026-11-04';
test('horaires fractionnés, semaine choisie, date explicite et repos', () => {
  const result = parseSchedule('Lundi 9h-12h 13h30–17h\n03/11/2026 10:00 à 18:00\nMercredi repos', reference);
  expect(result.issues).toEqual([]);
  expect(result.slots).toEqual([
    { date: '2026-11-02', start: '09:00', end: '12:00' },
    { date: '2026-11-02', start: '13:30', end: '17:00' },
    { date: '2026-11-03', start: '10:00', end: '18:00' },
  ]);
});
test('année explicite et semaine à cheval sur une année ne sont pas remplacées par aujourd’hui', () => {
  expect(parseSchedule('2027-01-02 09:00-17:00\n01/01 10h-12h', '2026-12-30').slots.map(s => s.date)).toEqual(['2027-01-02', '2026-01-01']);
  expect(parseSchedule('Vendredi 09h-17h', '2026-12-30').slots[0].date).toBe('2027-01-01');
});
test.each(['31/02/2026 09h-17h', 'Lundi 03/11/2026 09h-17h', 'Lundi 9:70-17:00', 'Mardi 22h-06h', 'Alice 09h-17h', 'Lundi 09h-17h Bob 10h-18h', 'Lundi 09:00', 'Lundi 25h-26h', 'Lundi 09h-09h', 'Lundi 009h-17h'])('rejette sans deviner : %s', line => {
  const result = parseSchedule(line, reference);
  expect(result.issues.length).toBeGreaterThan(0);
  expect(result.slots).toHaveLength(0);
});
test('une ligne partiellement invalide ne laisse pas importer la première plage silencieusement', () => {
  const result = parseSchedule('Lundi 09h-12h 23h-06h', reference);
  expect(result.slots).toEqual([]);
  expect(result.issues).toHaveLength(1);
});
test('ne tronque pas silencieusement les gros documents ni les lots de plus de 52', () => {
  expect(parseSchedule('x'.repeat(12001), reference).issues).toHaveLength(1);
  const text = Array.from({ length: 53 }, (_, i) => `Lundi ${String(Math.floor(i / 4)).padStart(2, '0')}:${String(i % 4 * 15).padStart(2, '0')}-23:59`).join('\n');
  expect(parseSchedule(text, reference).issues).toHaveLength(1);
});
test('déduplique le document et les créneaux existants sans masquer ceux du partenaire', () => {
  const slots = parseSchedule('Lundi 9h-17h\nLundi 9h-17h', reference).slots;
  expect(slots).toHaveLength(1);
  const existing: AgendaEvent[] = [{ ...slots[0], id: 'fictif', title: 'Bureau', who: 'alice', kind: 'travail', createdBy: 'bob' }];
  expect(newScheduleSlots(slots, existing, 'alice')).toEqual([]);
  expect(newScheduleSlots(slots, existing, 'bob')).toEqual(slots);
  expect(newScheduleSlots(slots, [{ ...existing[0], kind: 'perso' }], 'alice')).toEqual(slots);
});
