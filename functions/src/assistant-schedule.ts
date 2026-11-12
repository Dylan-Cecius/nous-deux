import { z } from 'zod';

// Compact OCR output avoids truncating large rotas with irrelevant null fields.
export const ScheduleResult = z.object({
  shifts: z.array(z.object({
    title: z.string().min(1).max(200),
    date: z.iso.date(),
    start: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
    end: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  })).max(52),
  reply: z.string().max(1000),
});

export function scheduleToAssistant(output: z.infer<typeof ScheduleResult>) {
  return {
    reply: output.reply,
    actions: output.shifts.map((shift) => ({
      ...shift, type: 'event' as const, summary: `${shift.title} · ${shift.date} · ${shift.start}–${shift.end}`,
      who: 'me' as const, repeatWeeks: null, status: null, cuisine: null, place: null,
      media: null, amount: null, paidBy: null, yearly: null,
    })),
  };
}
