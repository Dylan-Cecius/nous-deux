const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ScheduleResult, scheduleToAssistant } = require('../lib/assistant-schedule');

const shift = { title: 'Travail', date: '2026-11-16', start: '09:00', end: '17:00' };

test('compact OCR schema rejects impossible calendar dates and malformed times', () => {
  assert.equal(ScheduleResult.safeParse({ shifts: [{ ...shift, date: '2026-02-29' }], reply: '' }).success, false);
  assert.equal(ScheduleResult.safeParse({ shifts: [{ ...shift, start: '25:00' }], reply: '' }).success, false);
  assert.equal(ScheduleResult.safeParse({ shifts: [shift], reply: 'À vérifier' }).success, true);
});

test('compact OCR supports 52 shifts and maps only the speaker, with no implicit repetition', () => {
  const output = ScheduleResult.parse({ shifts: Array.from({ length: 52 }, () => shift), reply: 'Vérifie les créneaux.' });
  const result = scheduleToAssistant(output);
  assert.equal(result.actions.length, 52);
  assert.equal(result.actions[0].who, 'me');
  assert.equal(result.actions[0].repeatWeeks, null);
  assert.equal(result.actions[0].type, 'event');
  assert.equal(result.actions[0].date, shift.date);
  assert.equal(ScheduleResult.safeParse({ shifts: [...output.shifts, shift], reply: '' }).success, false);
});
