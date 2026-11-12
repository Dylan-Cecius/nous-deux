import type { Backend } from './backend';
import { addDays } from './dates';
import { BOTH, type Member } from './types';

/** Une action proposée par l'assistant IA (même forme que dans functions/src/index.ts). */
export type AssistantAction = {
  type: 'restaurant' | 'event' | 'date' | 'bucket' | 'film' | 'shopping' | 'note' | 'gift' | 'expense';
  /** Phrase courte en français, affichée pour confirmation. */
  summary: string;
  title: string;
  who: 'me' | 'partner' | 'both' | null;
  date: string | null;
  start: string | null;
  end: string | null;
  repeatWeeks: number | null;
  status: 'envie' | 'favori' | 'teste' | null;
  cuisine: string | null;
  place: string | null;
  media: 'film' | 'serie' | null;
  amount: number | null;
  paidBy: 'me' | 'partner' | null;
  yearly: boolean | null;
};

export type AssistantResult = { actions: AssistantAction[]; reply: string };

export type AssistantInput = { text: string } | { imageBase64: string; mediaType: string; weekStart: string };

export function askAssistant(backend: Backend, input: AssistantInput) {
  return backend.call<AssistantResult>('assistant', input);
}

type Ctx = { backend: Backend; me?: Member; partner?: Member };

/** Prévient ta moitié par une notification push (si son téléphone est enregistré). */
export async function notifyPartner({ backend }: Ctx, title: string, _body?: string) {
  if (backend.mode !== 'cloud') return;
  const kind = title === 'Agenda' ? 'event' : title === 'Question du jour' ? 'answer' : title === 'ping' ? 'ping' : 'note';
  // Le serveur vérifie le destinataire et n'envoie aucun contenu intime dans la notification.
  try { await backend.call('notifyPartner', { kind }); }
  catch { /* L'enregistrement reste réussi même si la notification ne part pas. */ }
}

export async function sendLoveNote(ctx: Ctx, text: string, kind: 'note' | 'ping' = 'note') {
  await ctx.backend.add('notes', { text, from: ctx.backend.userId, kind, createdAt: Date.now() });
  await notifyPartner(ctx, kind);
}

const ICONS: Record<AssistantAction['type'], string> = {
  restaurant: 'restaurant-outline',
  event: 'calendar-outline',
  date: 'hourglass-outline',
  bucket: 'sparkles-outline',
  film: 'film-outline',
  shopping: 'cart-outline',
  note: 'mail-outline',
  gift: 'gift-outline',
  expense: 'wallet-outline',
};

export const actionIcon = (a: AssistantAction) => ICONS[a.type];

/** Applique une action validée par l'utilisateur. */
export async function applyAction(ctx: Ctx, a: AssistantAction) {
  const { backend, partner } = ctx;
  const memberId = (w: 'me' | 'partner' | 'both' | null) =>
    w === 'partner' && partner ? partner.id : w === 'both' ? BOTH : backend.userId;
  const base = { createdBy: backend.userId, createdAt: Date.now() };

  switch (a.type) {
    case 'restaurant':
      return backend.add('restaurants', {
        ...base,
        name: a.title,
        cuisine: a.cuisine ?? '',
        place: a.place ?? '',
        status: a.status ?? 'envie',
        rating: 0,
        note: '',
      });
    case 'event': {
      const { date, start, end } = a;
      if (!date || !start || !end) return;
      const weeks = Math.min(52, Math.max(1, Math.floor(a.repeatWeeks ?? 1)));
      const seriesId = weeks > 1 ? `${Date.now()}` : undefined;
      await backend.addEvents(Array.from({ length: weeks }, (_, i) => ({
          title: a.title,
          date: addDays(date, i * 7),
          start,
          end,
          who: memberId(a.who),
          kind: a.who === 'both' ? 'ensemble' : 'travail',
          seriesId,
          createdBy: backend.userId,
        })));
      return notifyPartner(ctx, 'Agenda', `${ctx.me?.name ?? 'Ta moitié'} a ajouté « ${a.title} ».`);
    }
    case 'date':
      if (!a.date) return;
      return backend.add('dates', { title: a.title, emoji: '', date: a.date, yearly: a.yearly ?? false });
    case 'bucket':
    case 'film':
    case 'shopping':
      return backend.add('items', {
        ...base,
        list: a.type === 'film' ? 'films' : a.type,
        title: a.title,
        detail: a.place ?? '',
        media: a.type === 'film' ? (a.media ?? 'film') : undefined,
        done: false,
      });
    case 'note':
      return sendLoveNote(ctx, a.title);
    case 'gift':
      return backend.add('gifts', { ...base, title: a.title, detail: '', done: false });
    case 'expense':
      if (!a.amount) return;
      return backend.add('expenses', {
        title: a.title,
        amount: a.amount,
        paidBy: a.paidBy === 'partner' && partner ? partner.id : backend.userId,
        kind: 'expense',
        createdAt: Date.now(),
      });
  }
}
