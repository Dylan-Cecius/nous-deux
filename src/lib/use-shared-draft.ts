import { useState } from 'react';

type Fields = Record<string, string | number>;
const normalized = (value: string | number) => typeof value === 'string' ? value.trim() : value;

/** Keep typed fields; adopt a received value only while that field is untouched.
 * The caller must key the form by identity and supply null while reads are unavailable.
 * This is not a server-side conflict resolution mechanism.
 */
export function useSharedDraft<T extends Fields>(initial: T, received: T | null) {
  const [draft, setDraft] = useState(() => ({ base: initial, values: initial }));
  if (received && Object.keys(draft.base).some((key) => received[key] !== draft.base[key])) {
    const values = { ...draft.values };
    for (const key of Object.keys(draft.base) as (keyof T)[]) {
      if (received[key] !== draft.base[key] && normalized(values[key]) === normalized(draft.base[key])) {
        values[key] = received[key];
      }
    }
    setDraft({ base: received, values });
  }
  const setValues = (update: (previous: T) => T) => setDraft((previous) => ({
    ...previous, values: update(previous.values),
  }));
  return { ...draft, setValues };
}

export function draftPatch<T extends Fields>(base: T, values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values)
    .filter(([key, value]) => normalized(value) !== normalized(base[key]))
    .map(([key, value]) => [key, normalized(value)])) as Partial<T>;
}
