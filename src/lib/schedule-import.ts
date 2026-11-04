import { addDays, fromKey, parseFrenchDate } from './dates';
import { mondayOf } from './agenda';
import type { AgendaEvent } from './types';

export type ScheduleSlot = Pick<AgendaEvent, 'date' | 'start' | 'end'>;
export const MAX_SCHEDULE_TEXT = 12000;
/** Prefix used by the OCR table reader for a row it could not read inside a table. */
export const UNREADABLE_ROW = 'Ligne illisible : ';

const weekdays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
// Full names first, then common abbreviations ("lun.", "mer", "ven").
const dayPattern = /(?:^|[^a-z])(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)\.?(?![a-z])/;
const isoDate = /(?:^|[^\d])(\d{4})-(\d{2})-(\d{2})(?![\d])/;
const slashDate = /(?:^|[^\d])(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?(?![\d]|\s*h|:)/;
const wordDate = new RegExp(`(?:^|[^\\d])(\\d{1,2})(?:er)?\\s+(${months.join('|')})(?:\\s+(\\d{4}))?(?![a-z])`);
// "9h", "9h30", "09:00", "9 h", "midi", "minuit". The preceding character must not be a digit ("009h").
const clock = /(^|[^\d])(?:(\d{1,2})\s*(?:h(\d{2})?|:(\d{2}))|(midi|minuit))(?![\d])/g;
// A bare hour right before a range separator borrows the "h" of the end: "9-17h", "de 9 à 17h".
const bareStart = /(^|[^\d:h])(\d{1,2})(?=\s*(?:-|>|→|a|au|jusqu'?a|jusque)\s*\d{1,2}\s*(?:h|:))/g;
const rangeGap = /^\s*(?:-+|>|->|→|~|\/|a|au|to|jusqu'?a|jusque|jusqu'?au)?\s*$/;
const pauseWord = /\b(?:pause|coupure|dejeuner|repas)\b/;
const betweenGap = /^(?:\s|[,;+|/&-]|et|puis|pause|coupure|dejeuner|repas|:)*$/;
const DAY = 24 * 60;
const MISSING_TIME = 'une heure de début ou de fin manque.';
const restDay = /\b(?:repos|off|conges?|libre|ferie|absent|rtt)\b/;

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[–—−]/g, '-').replace(/[’`]/g, "'").replace(/^[\s•·*]+/, '').trim();
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

type Found = { date: string | null; dateError: boolean; rest: string; hasDay: boolean };

/** Find a weekday and/or a date anywhere in the line; both are removed from `rest`. */
function findDate(line: string, reference: string): Found {
  let rest = line;
  let date: string | null = null;
  let explicit = false;
  let dateError = false;
  const take = (match: RegExpExecArray) => { rest = rest.slice(0, match.index) + ' ' + rest.slice(match.index + match[0].length); };
  const iso = isoDate.exec(rest);
  const word = !iso && wordDate.exec(rest);
  const slash = !iso && !word && slashDate.exec(rest);
  if (iso) { date = parseFrenchDate(`${iso[3]}/${iso[2]}/${iso[1]}`); take(iso); explicit = true; }
  else if (word) { date = parseFrenchDate(`${word[1]}/${months.indexOf(word[2]) + 1}/${word[3] ?? reference.slice(0, 4)}`); take(word); explicit = true; }
  else if (slash) { date = parseFrenchDate(`${slash[1]}/${slash[2]}/${slash[3] ?? reference.slice(0, 4)}`); take(slash); explicit = true; }
  if (explicit && !date) dateError = true;
  const day = dayPattern.exec(rest);
  if (day) {
    take(day);
    const index = weekdays.findIndex(name => name.startsWith(day[1]));
    if (date && (fromKey(date).getDay() + 6) % 7 !== index) { date = null; dateError = true; }
    else if (!explicit) date = addDays(mondayOf(reference), index);
  }
  return { date, dateError, rest, hasDay: !!day || explicit };
}

type Ranges = { ranges: [number, number][] } | { error: string };

/** Pair the times of a line in reading order: start, end, start, end… */
function readRanges(text: string): Ranges {
  const prepared = text.replace(bareStart, '$1$2h');
  const times: { value: number; start: number; end: number }[] = [];
  for (const match of prepared.matchAll(clock)) {
    const at = match.index + match[1].length;
    const h = match[5] ? (match[5] === 'midi' ? 12 : 0) : +match[2];
    const m = match[5] ? 0 : +(match[3] ?? match[4] ?? 0);
    if (h > 23 || m > 59) return { error: 'heure invalide : corrige-la dans le texte.' };
    times.push({ value: h * 60 + m, start: at, end: match.index + match[0].length });
  }
  if (!times.length) return { ranges: [] };
  if (times.length % 2) return { error: MISSING_TIME };
  const gap = (from: number, to: number) => prepared.slice(from, to).trim();
  if (/\d/.test(gap(0, times[0].start)) || /\d/.test(gap(times[times.length - 1].end, prepared.length))) {
    return { error: 'un nombre n’a pas été compris : garde le jour et les heures.' };
  }
  const ranges: [number, number][] = [];
  for (let i = 0; i < times.length; i += 2) {
    const [start, end] = [times[i], times[i + 1]];
    if (!rangeGap.test(gap(start.end, end.start))) return { error: 'les heures doivent aller par deux (début puis fin).' };
    if (start.value === end.value) return { error: 'le début et la fin sont identiques.' };
    let [s, e] = [start.value, end.value];
    const last = ranges[ranges.length - 1];
    // After a night shift, a break written "2h-3h" belongs to the next morning.
    if (last && last[1] > DAY && s < last[0]) { s += DAY; e += DAY; }
    // Night shift: an end before the start finishes the next day ("22h-6h").
    if (e < s) e += DAY;
    if (i) {
      const between = gap(times[i - 1].end, start.start);
      // Other words between two ranges may name another person: do not guess.
      if (!betweenGap.test(between)) return { error: 'plusieurs horaires séparés par un texte inconnu (une autre personne ?). Garde une seule personne.' };
      // "9h-17h pause 12h-13h": the break is cut out of the shift.
      if (pauseWord.test(between) && s >= last[0] && e <= last[1]) {
        ranges.splice(ranges.length - 1, 1, ...[[last[0], s], [e, last[1]]].filter(([a, b]) => a < b) as [number, number][]);
        continue;
      }
    }
    ranges.push([s, e]);
  }
  return { ranges };
}

/**
 * Tolerant reading of a schedule: a day or date and times anywhere on the line,
 * with or without a dash ("Lundi 9h 17h", "lun. de 9h à 17h", "2 novembre 9:00 > 17:00").
 * Lines with neither a day nor a time are ignored (titles, menus). It never infers a person,
 * or an ambiguous column order (night shifts are split at midnight): those lines are reported for correction.
 */
export function parseSchedule(text: string, referenceDate: string) {
  const slots: ScheduleSlot[] = [];
  const issues: string[] = [];
  if (text.length > MAX_SCHEDULE_TEXT) return { slots, issues: ['Le texte est trop long. Importe au maximum 52 créneaux à la fois.'] };
  const reference = parseFrenchDate(referenceDate.split('-').reverse().join('/'));
  if (!reference) return { slots, issues: ['Choisis une date de référence valide.'] };
  const lines = text.split(/\r?\n/).map(normalize);
  const headers = lines.filter(line => /\bjours?\b.*\bdebut\b.*\bfin\b/.test(line) && !/\d/.test(line));
  if (headers.length > 1) issues.push('Plusieurs tableaux détectés : photographie un seul tableau à la fois.');
  // Only when the first "Fin" comes before the first "Début" ("Jour Début Fin Début Fin" is a split shift).
  if (lines.some(line => !/\d/.test(line) && /\bdebut\b/.test(line) && /^(?:(?!\bdebut\b).)*\bfin\b/.test(line))) issues.push('La colonne « Fin » est avant « Début » : vérifie l’ordre des heures dans le texte.');
  const fail = (line: number, reason: string) => issues.push(`Ligne ${line + 1} : ${reason}`);
  // An agenda event stays within one day: a night shift is split at midnight
  // (…→23:59 then 00:00→…), parts after midnight go on the next day.
  const add = (date: string, ranges: [number, number][]) => {
    for (const [start, end] of ranges) {
      if (start < DAY) slots.push({ date, start: hhmm(start), end: end > DAY ? '23:59' : hhmm(end === DAY ? DAY - 1 : end) });
      if (end > DAY) slots.push({ date: addDays(date, 1), start: hhmm(Math.max(start - DAY, 0)), end: hhmm(end - DAY) });
    }
  };
  // A day without (all) its times ("Lundi" / "9h00" / "17h00") collects the following lines.
  let pending: { date: string; line: number; text: string } | null = null;
  const closePending = () => {
    if (pending && /\d/.test(pending.text)) fail(pending.line, MISSING_TIME);
    pending = null;
  };
  const unreadable = normalize(UNREADABLE_ROW).replace(/\s+$/, '');
  for (const [index, line] of lines.entries()) {
    if (!line) continue;
    if (line.startsWith(unreadable)) { closePending(); fail(index, 'illisible dans le tableau : corrige-la ou supprime-la.'); continue; }
    const found = findDate(line, reference);
    if (found.dateError) { closePending(); fail(index, 'date invalide ou qui ne correspond pas au jour.'); continue; }
    if (!found.hasDay && pending) {
      const text: string = `${pending.text} ${found.rest}`;
      const read = readRanges(text);
      if ('error' in read) {
        if (read.error === MISSING_TIME) { pending.text = text; continue; }
        pending = null; fail(index, read.error); continue;
      }
      if (read.ranges.length) { add(pending.date, read.ranges); pending = null; }
      continue;
    }
    closePending();
    const read = readRanges(found.rest);
    if ('error' in read) {
      if (read.error === MISSING_TIME && found.date) pending = { date: found.date, line: index, text: found.rest };
      else fail(index, read.error);
      continue;
    }
    if (!read.ranges.length) {
      // Title, rest day or unrelated text are ignored; a day alone waits for its times.
      if (found.date && !restDay.test(found.rest)) pending = { date: found.date, line: index, text: found.rest };
      continue;
    }
    if (!found.date) { fail(index, 'jour ou date manquant devant ces horaires.'); continue; }
    add(found.date, read.ranges);
  }
  closePending();
  const unique = [...new Map(slots.map(slot => [`${slot.date}/${slot.start}/${slot.end}`, slot])).values()];
  if (unique.length > 52) issues.push('Maximum 52 créneaux par import. Réduis le texte avant de continuer.');
  return { slots: unique, issues };
}

export function newScheduleSlots(slots: ScheduleSlot[], existing: AgendaEvent[], who: string) {
  return slots.filter(slot => !existing.some(event => event.kind === 'travail' && event.who === who && event.date === slot.date && event.start === slot.start && event.end === slot.end));
}
