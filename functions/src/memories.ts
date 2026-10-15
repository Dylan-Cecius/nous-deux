import { createHash } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { activeUid, consumeQuota, memberCouple, parse } from './security';

const COMPACT_PREFIX = 'data:image/jpeg;base64,';
const MAX_COMPACT_BASE64 = 600_000;
const inputSchema = z.object({
  coupleId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  expectedUserId: z.string().min(1).max(128),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{12,80}$/),
  photoUrl: z.string().min(1).max(MAX_COMPACT_BASE64 - 1 + COMPACT_PREFIX.length),
  caption: z.string().trim().max(4000),
  date: z.iso.date(),
}).strict();

const invalidPhoto = () => new HttpsError('invalid-argument', 'Cette photo ne peut pas être associée à ce souvenir.');

/** Validate a reference, never fetch a client-supplied URL. */
function photoReference(photoUrl: string, coupleId: string, uid: string) {
  if (photoUrl.startsWith('data:')) {
    // Existing compact JPEG fallback. No new provider or upload is introduced.
    const encoded = photoUrl.slice(COMPACT_PREFIX.length);
    if (!photoUrl.startsWith(COMPACT_PREFIX) || encoded.length >= MAX_COMPACT_BASE64 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw invalidPhoto();
    return null;
  }
  try {
    const url = new URL(photoUrl);
    const parts = url.pathname.split('/');
    const bucket = getStorage().bucket();
    const path = decodeURIComponent(parts[5] ?? '');
    const segments = path.split('/');
    const token = url.searchParams.get('token');
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || url.port || url.username || url.password || url.hash ||
      parts.length !== 6 || parts[1] !== 'v0' || parts[2] !== 'b' || decodeURIComponent(parts[3]) !== bucket.name || parts[4] !== 'o' ||
      segments.length !== 5 || segments[0] !== 'couples' || segments[1] !== coupleId || segments[2] !== 'photos' || segments[3] !== uid ||
      !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,199}$/.test(segments[4]) ||
      url.searchParams.get('alt') !== 'media' || !token || token.length > 200 ||
      url.searchParams.getAll('token').length !== 1 || url.searchParams.getAll('alt').length !== 1 ||
      [...url.searchParams.keys()].some((key) => !['token', 'alt'].includes(key))) throw invalidPhoto();
    return { file: bucket.file(path), token };
  } catch { throw invalidPhoto(); }
}

/** Prepared only, intentionally NOT exported by index.ts until release prerequisites are met.
 * Receipt + memory are atomic. Storage is not in that transaction: no orphan cleanup
 * or compensation is attempted, and an independently deleted file can still disappear.
 */
export const associateMemory = onCall({ region: 'europe-west1', maxInstances: 3, concurrency: 10 }, async (request) => {
  const uid = await activeUid(request);
  if (request.data?.expectedUserId !== uid) {
    throw new HttpsError('failed-precondition', 'Le compte a changé. Rouvre l’album avant de réessayer.');
  }
  const input = parse(inputSchema, request.data);
  const photo = photoReference(input.photoUrl, input.coupleId, uid);
  const { ref: coupleRef } = await memberCouple(uid, input.coupleId);
  await consumeQuota([{ key: `memory-associations:${uid}`, maximum: 30, windowMs: 3_600_000 }]);
  const digest = createHash('sha256').update(JSON.stringify([input.photoUrl, input.caption, input.date])).digest('hex');
  const receiptRef = coupleRef.collection('private').doc(uid).collection('memoryRequests').doc(input.requestId);
  const memoryRef = coupleRef.collection('memories').doc();
  return getFirestore().runTransaction(async (tx) => {
    const [couple, receipt] = await tx.getAll(coupleRef, receiptRef);
    const data = couple.data();
    if (!data?.members?.includes(uid)) throw new HttpsError('permission-denied', 'Accès refusé.');
    if (data.deletionLock) throw new HttpsError('failed-precondition', 'Cet espace est temporairement indisponible pendant une suppression.');
    if (receipt.exists) {
      if (receipt.data()!.fingerprint !== digest) throw new HttpsError('failed-precondition', 'Cette demande correspond déjà à un autre souvenir.');
      // A replay must not recreate a removed memory or require its photo to survive.
      return { memoryId: receipt.data()!.memoryId as string };
    }
    if (photo) {
      let metadata;
      try { [metadata] = await photo.file.getMetadata(); }
      catch { throw new HttpsError('failed-precondition', 'La photo envoyée n’est pas disponible. Réessaie après vérification de l’album.'); }
      const size = Number(metadata.size);
      const tokens = String(metadata.metadata?.firebaseStorageDownloadTokens ?? '').split(',');
      if (!Number.isFinite(size) || size <= 0 || size >= 10 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(metadata.contentType ?? '') || !tokens.includes(photo.token)) throw invalidPhoto();
    }
    tx.create(memoryRef, { photoUrl: input.photoUrl, caption: input.caption, date: input.date, createdBy: uid, createdAt: FieldValue.serverTimestamp() });
    tx.create(receiptRef, { fingerprint: digest, memoryId: memoryRef.id, createdAt: FieldValue.serverTimestamp() });
    return { memoryId: memoryRef.id };
  });
});
