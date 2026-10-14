import { addDays, fromKey } from './dates';
import type { AgendaEvent } from './types';

/** Plage où l'on cherche des créneaux libres en commun : 8h – 23h. */
export const FREE_START = 8 * 60;
export const FREE_END = 23 * 60;

/** « 09:30 » → 570 minutes. */
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** 570 minutes → « 9:30 ». */
export const fromMin = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

/** Fin en minutes ; un horaire de nuit (fin ≤ début) est coupé à minuit. */
export const endMin = (e: Pick<AgendaEvent, 'start' | 'end'>) => {
  const s = toMin(e.start);
  const end = toMin(e.end);
  return end <= s ? 24 * 60 : end;
};

/** Créneaux d'au moins 1 h où personne n'est occupé, entre 8h et 23h. */
export function freeSlots(events: Pick<AgendaEvent, 'start' | 'end'>[]) {
  const busy = events.map((e) => [toMin(e.start), endMin(e)] as const).sort((a, b) => a[0] - b[0]);
  const slots: [number, number][] = [];
  let cursor = FREE_START;
  for (const [s, e] of busy) {
    if (s > cursor) slots.push([cursor, Math.min(s, FREE_END)]);
    cursor = Math.max(cursor, e);
    if (cursor >= FREE_END) break;
  }
  if (cursor < FREE_END) slots.push([cursor, FREE_END]);
  return slots.filter(([s, e]) => e - s >= 60);
}

/** Lundi de la semaine d'une date (YYYY-MM-DD). */
export function mondayOf(key: string) {
  const day = (fromKey(key).getDay() + 6) % 7;
  return addDays(key, -day);
}
