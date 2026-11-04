import { getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const DAY = 86_400_000;
export const RETENTION = { expiredQuotaMs: 7 * DAY, completedDeletionMs: 30 * DAY };

/** Only disposable technical records. Never traverses couples, users or photos. */
export async function purgeTechnicalData(now = Date.now(), pageSize = 100) {
  if (!Number.isFinite(now) || now <= 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error('Invalid retention run parameters');
  }
  const db = getFirestore();
  const counts = { invitations: 0, rateLimits: 0, completedDeletions: 0 };
  const old = (value: unknown, cutoff: number): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= cutoff;

  // Bounded runs avoid an unbounded bill. A backlog is continued by the next daily run.
  for (const spec of [
    { collection: 'invitations', field: 'expiresAt', cutoff: now, count: 'invitations' },
    { collection: 'rateLimits', field: 'resetAt', cutoff: now - RETENTION.expiredQuotaMs, count: 'rateLimits' },
    { collection: 'accountDeletions', field: 'completedAt', cutoff: now - RETENTION.completedDeletionMs, count: 'completedDeletions' },
  ] as const) {
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    for (let page = 0; page < 5; page++) {
      let query = db.collection(spec.collection).where(spec.field, '<=', spec.cutoff).orderBy(spec.field).limit(pageSize);
      if (cursor) query = query.startAfter(cursor);
      const candidates = await query.get();
      if (candidates.empty) break;
      for (const candidate of candidates.docs) {
        const deleted = await db.runTransaction(async tx => {
          // Recheck inside the transaction: a quota may have been reset after the query.
          const current = (await tx.get(candidate.ref)).data();
          if (!current || !old(current[spec.field], spec.cutoff)) return false;
          if (spec.collection === 'accountDeletions' && (current.status !== 'complete' || current.leaseUntil > now)) return false;
          if (spec.collection === 'invitations') {
            if (typeof current.coupleId !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(current.coupleId)) return false;
            const pointer = await tx.get(db.doc(`coupleInvitations/${current.coupleId}`));
            // A newer invitation must survive the cleanup of an older one.
            if (pointer.data()?.digest === candidate.id) tx.delete(pointer.ref);
          }
          tx.delete(candidate.ref);
          return true;
        });
        if (deleted) counts[spec.count]++;
      }
      if (candidates.size < pageSize) break;
      cursor = candidates.docs[candidates.docs.length - 1];
    }
  }
  return counts;
}

export const cleanupTechnicalData = onSchedule({
  schedule: 'every 24 hours', region: 'europe-west1', timeoutSeconds: 540, maxInstances: 1,
}, async () => {
  const counts = await purgeTechnicalData();
  console.info('Technical retention cleanup completed', counts);
});
