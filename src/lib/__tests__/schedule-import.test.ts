import type { AssistantAction } from '../assistant';
import { eventProblem, prepareScheduleEvents, validScheduleDate } from '../schedule-import';

const shift = (patch: Partial<AssistantAction> = {}): AssistantAction => ({
  type: 'event', title: 'Travail', summary: 'Travail lundi', who: 'me', date: '2026-11-16', start: '09:00', end: '17:00',
  repeatWeeks: null, status: null, cuisine: null, place: null, media: null, amount: null, paidBy: null, yearly: null, ...patch,
});

test('rejects impossible OCR dates and reversed or malformed hours before writing', () => {
  expect(validScheduleDate('2026-02-29')).toBe(false);
  expect(validScheduleDate('2028-02-29')).toBe(true);
  expect(eventProblem(shift({ date: '2026-04-31' }))).toContain('date');
  expect(eventProblem(shift({ start: '22:00', end: '06:00' }))).toContain('nuit');
  expect(eventProblem(shift({ start: '9:00' }))).toContain('heures');
  expect(() => prepareScheduleEvents([shift(), shift({ end: '07:00' })], 'me', 'partner')).toThrow();
});

test('suppresses exact duplicates inside a scan and from an earlier import', () => {
  const existing = { id: 'old', ...prepareScheduleEvents([shift()], 'me', 'partner').events[0] };
  const next = shift({ date: '2026-11-17' });
  const result = prepareScheduleEvents([shift(), next, next], 'me', 'partner', [existing]);
  expect(result.events).toHaveLength(1);
  expect(result.events[0].date).toBe('2026-11-17');
  expect(result.duplicates).toBe(2);
});

test('keeps separate members and expands repeated shifts together within the batch limit', () => {
  const result = prepareScheduleEvents([shift({ repeatWeeks: 2 }), shift({ who: 'partner' })], 'alice', 'bob');
  expect(result.events.map(({ date, who }) => [date, who])).toEqual([
    ['2026-11-16', 'alice'], ['2026-11-23', 'alice'], ['2026-11-16', 'bob'],
  ]);
  expect(() => prepareScheduleEvents([shift({ repeatWeeks: 52 }), shift({ date: '2026-11-17' })], 'alice', 'bob')).toThrow('52');
});
