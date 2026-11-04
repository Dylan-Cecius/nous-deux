import type { Backend } from './backend';

type AssociationBackend = Pick<Backend, 'mode' | 'userId' | 'coupleId' | 'call'>;
type MemoryIntent = Readonly<{ requestId: string; photoUrl: string; caption: string; date: string }>;
export type MemoryAssociationResult =
  | Readonly<{ status: 'stale' | 'blocked' | 'unconfirmed' }>
  // A receipt does not prove that the memory still exists in the current album.
  | Readonly<{ status: 'receipt-confirmed'; memoryId: string }>;

/** Prepared only: no active screen imports this module. No upload, persistence,
 * automatic retry or fallback creation. One instance represents one immutable
 * intention AFTER a successful upload; callers must keep it for explicit retry.
 */
export function prepareMemoryAssociation(
  backend: AssociationBackend,
  input: MemoryIntent,
  guard: { isCurrent: () => boolean; canSubmit: () => boolean },
) {
  const userId = backend.userId;
  const coupleId = backend.coupleId;
  const parsedDate = new Date(`${input.date}T00:00:00.000Z`);
  if (backend.mode !== 'cloud' || !userId || userId.length > 128 || !/^[A-Za-z0-9_-]{6,64}$/.test(coupleId) ||
    !/^[A-Za-z0-9_-]{12,80}$/.test(input.requestId) || !input.photoUrl || input.photoUrl.length > 600022 ||
    input.caption.trim().length > 4000 || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.date) {
    throw new Error('Cette demande de souvenir ne peut pas être préparée.');
  }
  let payload: (MemoryIntent & { expectedUserId: string; coupleId: string }) | null = {
    requestId: input.requestId, photoUrl: input.photoUrl, caption: input.caption.trim(), date: input.date,
    expectedUserId: userId, coupleId,
  };
  let confirmed: MemoryAssociationResult | null = null;
  let pending: Promise<MemoryAssociationResult> | null = null;
  const invalidate = () => { payload = null; confirmed = null; };
  const isCurrent = () => {
    if (!payload) return false;
    if (backend.mode !== 'cloud' || backend.userId !== userId || backend.coupleId !== coupleId || !guard.isCurrent()) {
      invalidate();
      return false;
    }
    return true;
  };

  const submit = (): Promise<MemoryAssociationResult> => {
    if (!isCurrent()) return Promise.resolve({ status: 'stale' });
    if (pending) return pending;
    if (confirmed) return Promise.resolve(confirmed);
    if (!guard.canSubmit()) return Promise.resolve({ status: 'blocked' });
    // Schedule once so the shared promise exists even if a test/adapter throws
    // synchronously. Recheck the scope immediately before starting the call.
    pending = Promise.resolve().then(async (): Promise<MemoryAssociationResult> => {
      if (!isCurrent()) return { status: 'stale' };
      if (!guard.canSubmit()) return { status: 'blocked' };
      try {
        const result = await backend.call<unknown>('associateMemory', { ...payload! });
        if (!isCurrent()) return { status: 'stale' };
        const id = result && typeof result === 'object' && !Array.isArray(result)
          ? (result as { memoryId?: unknown }).memoryId : null;
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return { status: 'unconfirmed' };
        confirmed = Object.freeze({ status: 'receipt-confirmed', memoryId: id });
        return confirmed;
      } catch {
        // A rejection, even an invalid response, is not proof of no commit.
        // Keep exactly the same key and payload; never expose raw error data.
        return { status: isCurrent() ? 'unconfirmed' : 'stale' };
      }
    }).finally(() => { pending = null; });
    return pending;
  };
  return { submit, invalidate };
}
