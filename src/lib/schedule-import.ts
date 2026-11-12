import type { AssistantAction } from './assistant';
import { addDays, fromKey, toKey } from './dates';
import { BOTH, type AgendaEvent } from './types';

export function validScheduleDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toKey(fromKey(value)) === value;
}

/** Validate every selected row before creating any writes. Reversed/night shifts
 * need correction in the preview because Firestore requires start < end. */
export function eventProblem(action: AssistantAction): string | null {
  if (action.type !== 'event') return null;
  if (!action.title.trim() || action.title.length > 200) return 'Ajoute un titre de 200 caractères maximum.';
  if (!validScheduleDate(action.date)) return 'Vérifie la date de cet horaire.';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!action.start || !action.end || !time.test(action.start) || !time.test(action.end)) return 'Vérifie les heures de début et de fin.';
  if (action.start >= action.end) return 'La fin doit être après le début. Pour une nuit, crée un créneau sur chaque jour.';
  if (action.repeatWeeks !== null && (!Number.isInteger(action.repeatWeeks) || action.repeatWeeks < 1 || action.repeatWeeks > 52)) return 'Choisis entre 1 et 52 semaines.';
  return null;
}

const fingerprint = (event: Pick<AgendaEvent, 'title' | 'date' | 'start' | 'end' | 'who'>) =>
  JSON.stringify([event.title.trim().toLocaleLowerCase('fr'), event.date, event.start, event.end, event.who]);

/** One import = one atomic batch. Avoid adding an exact duplicate from the
 * photo, a previous successful import, or an ambiguous retry. */
export function prepareScheduleEvents(
  actions: AssistantAction[],
  userId: string,
  partnerId: string | undefined,
  existing: AgendaEvent[] = [],
): { events: Omit<AgendaEvent, 'id'>[]; duplicates: number } {
  const events: Omit<AgendaEvent, 'id'>[] = [];
  const seen = new Set(existing.map(fingerprint));
  let duplicates = 0;
  for (const action of actions) {
    if (action.type !== 'event') throw new Error('Un planning ne peut contenir que des horaires.');
    const problem = eventProblem(action);
    if (problem) throw new Error(problem);
    const weeks = action.repeatWeeks ?? 1;
    const who = action.who === 'both' ? BOTH : action.who === 'partner' && partnerId ? partnerId : userId;
    for (let i = 0; i < weeks; i++) {
      const event = {
        title: action.title.trim(), date: addDays(action.date!, i * 7), start: action.start!, end: action.end!,
        who, kind: action.who === 'both' ? 'ensemble' as const : 'travail' as const, createdBy: userId,
      };
      const key = fingerprint(event);
      if (seen.has(key)) { duplicates++; continue; }
      if (events.length >= 52) throw new Error('Importe au maximum 52 horaires à la fois.');
      seen.add(key);
      events.push(event);
    }
  }
  return { events, duplicates };
}
