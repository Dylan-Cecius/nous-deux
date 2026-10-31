import { addDays, fromKey, parseFrenchDate } from './dates';
import { mondayOf } from './agenda';
import type { AgendaEvent } from './types';

export type ScheduleSlot = Pick<AgendaEvent, 'date' | 'start' | 'end'>;
export const MAX_SCHEDULE_TEXT = 12000;
const weekdays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Conservative OCR interpretation: never infer a person or a table's column order. */
export function parseSchedule(text: string, referenceDate: string) {
  const slots: ScheduleSlot[] = [];
  const issues: string[] = [];
  if (text.length > MAX_SCHEDULE_TEXT) return { slots, issues: ['Le texte est trop long. Importe au maximum 52 créneaux à la fois.'] };
  const reference = parseFrenchDate(referenceDate.split('-').reverse().join('/'));
  if (!reference) return { slots, issues: ['Choisis une date de référence valide.'] };
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  lines.forEach((source, index) => {
    let line = source.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[–—]/g, '-').replace(/^[•·*]\s*/, '');
    const day = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b[\s,:]*/.exec(line);
    if (day) line = line.slice(day[0].length);
    const explicit = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{4})?)(?=\s|$)\s*/.exec(line);
    let date: string | null = null;
    if (explicit) {
      const raw = explicit[1];
      const french = raw.includes('-') ? raw.split('-').reverse().join('/') : raw.split('/').length === 2 ? `${raw}/${reference.slice(0, 4)}` : raw;
      date = parseFrenchDate(french);
      line = line.slice(explicit[0].length);
      if (day && date && (fromKey(date).getDay() + 6) % 7 !== weekdays.indexOf(day[1])) date = null;
    } else if (day) date = addDays(mondayOf(reference), weekdays.indexOf(day[1]));
    const fail = (reason: string) => issues.push(`Ligne ${index + 1} : ${reason}`);
    if (!date) { fail('date absente, invalide ou incohérente avec le jour.'); return; }
    if (/^(repos|off|conge|conges)$/.test(line)) return;
    const ranges = [...line.matchAll(/(\d{1,2})(?::(\d{2})|h(\d{2})?)\s*(?:-|a)\s*(\d{1,2})(?::(\d{2})|h(\d{2})?)/g)];
    const remainder = line.replace(/(\d{1,2})(?::(\d{2})|h(\d{2})?)\s*(?:-|a)\s*(\d{1,2})(?::(\d{2})|h(\d{2})?)/g, '').replace(/[\s,;|]/g, '');
    if (!ranges.length || remainder) { fail('garde seulement la date et les heures, par exemple 02/11/2026 09:00-17:00.'); return; }
    const parsed: ScheduleSlot[] = [];
    for (const match of ranges) {
      const [sh, sm, eh, em] = [+match[1], +(match[2] ?? match[3] ?? 0), +match[4], +(match[5] ?? match[6] ?? 0)];
      if (sh > 23 || eh > 23 || sm > 59 || em > 59 || sh * 60 + sm >= eh * 60 + em) {
        fail('heures invalides ou horaire de nuit : corrige ce créneau avant l’import.'); return;
      }
      parsed.push({ date, start: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`, end: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}` });
    }
    slots.push(...parsed);
  });
  const unique = [...new Map(slots.map(slot => [`${slot.date}/${slot.start}/${slot.end}`, slot])).values()];
  if (unique.length > 52) issues.push('Maximum 52 créneaux par import. Réduis le texte avant de continuer.');
  return { slots: unique, issues };
}

export function newScheduleSlots(slots: ScheduleSlot[], existing: AgendaEvent[], who: string) {
  return slots.filter(slot => !existing.some(event => event.kind === 'travail' && event.who === who && event.date === slot.date && event.start === slot.start && event.end === slot.end));
}
