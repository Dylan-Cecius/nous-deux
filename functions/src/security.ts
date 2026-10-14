import { createHash, randomInt, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type DocumentData } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { z } from 'zod';

export const AI_CONSENT_VERSION = 'anthropic-2026-10-14';
const REGION = 'europe-west1';
const options = { region: REGION, maxInstances: 5 };
const profileSchema = z.object({ name: z.string().trim().min(1).max(60), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).strict();
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpsError('invalid-argument', 'Les informations envoyées ne sont pas valides.');
  return result.data;
}

export async function activeUid(request: CallableRequest): Promise<string> {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Connecte-toi pour continuer.');
  if ((await getFirestore().doc(`accountDeletions/${uid}`).get()).exists) {
    throw new HttpsError('failed-precondition', 'La suppression de ce compte est en cours.');
  }
  return uid;
}

export async function memberCouple(uid: string, rawId: unknown) {
  const coupleId = parse(idSchema, rawId);
  const ref = getFirestore().doc(`couples/${coupleId}`);
  const snap = await ref.get();
  const data = snap.data();
  if (!data?.members?.includes(uid)) throw new HttpsError('permission-denied', 'Accès refusé.');
  if (data.deletionLock) throw new HttpsError('failed-precondition', 'Cet espace est temporairement indisponible pendant une suppression.');
  return { ref, data, coupleId };
}

/** Transaction atomique : un appel concurrent ne peut pas dépasser le quota. */
export async function consumeQuota(limits: { key: string; maximum: number; windowMs: number }[], now = Date.now()) {
  const db = getFirestore();
  const entries = limits.map((l) => ({ ...l, ref: db.doc(`rateLimits/${hash(l.key)}`) }));
  await db.runTransaction(async (tx) => {
    const snapshots = await tx.getAll(...entries.map((e) => e.ref));
    const next = entries.map((e, i) => {
      const old = snapshots[i].data();
      const fresh = !old || old.resetAt <= now;
      const count = fresh ? 0 : old.count;
      if (count >= e.maximum) throw new HttpsError('resource-exhausted', 'Limite atteinte. Réessaie plus tard.');
      return { count: count + 1, resetAt: fresh ? now + e.windowMs : old.resetAt };
    });
    entries.forEach((e, i) => tx.set(e.ref, next[i]));
  });
}

async function protectInvitation(request: CallableRequest, uid: string, action: string) {
  // IP hachée avec une clé distincte par jour : aucune adresse brute n'est conservée.
  const ipKey = hash(`${new Date().toISOString().slice(0, 10)}:${request.rawRequest.ip ?? 'unknown'}`);
  await consumeQuota([
    { key: `${action}:user:${uid}`, maximum: 10, windowMs: 15 * 60_000 },
    { key: `${action}:ip:${ipKey}`, maximum: 30, windowMs: 15 * 60_000 },
    { key: `${action}:global`, maximum: 1000, windowMs: 86_400_000 },
  ]);
}

export async function createSpace(uid: string, input: unknown) {
  const profile = parse(profileSchema, input);
  const db = getFirestore();
  const ref = db.collection('couples').doc();
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const user = await tx.get(userRef);
    if (user.data()?.coupleId) throw new HttpsError('already-exists', 'Tu as déjà un espace. Reconnecte-toi pour le retrouver.');
    tx.create(ref, { members: [uid], profiles: { [uid]: profile }, createdAt: Date.now(), securityVersion: 2 });
    tx.set(userRef, { coupleId: ref.id });
  });
  return { coupleId: ref.id };
}

export const createCouple = onCall(options, async (request) => {
  const uid = await activeUid(request);
  await protectInvitation(request, uid, 'create');
  return createSpace(uid, request.data?.profile);
});

export async function issueInvitation(uid: string, rawId: unknown) {
  const { ref: coupleRef } = await memberCouple(uid, rawId);
  const db = getFirestore();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join('');
  const digest = hash(code);
  const expiresAt = Date.now() + 24 * 60 * 60_000;
  await db.runTransaction(async (tx) => {
    const [couple, pointer] = await tx.getAll(coupleRef, db.doc(`coupleInvitations/${coupleRef.id}`));
    const data = couple.data();
    if (!data?.members?.includes(uid) || data.deletionLock || data.members.length !== 1) {
      throw new HttpsError('failed-precondition', 'Une invitation est possible uniquement lorsque tu es seul dans cet espace.');
    }
    if (pointer.data()?.digest) tx.delete(db.doc(`invitations/${pointer.data()!.digest}`));
    tx.create(db.doc(`invitations/${digest}`), { coupleId: coupleRef.id, invitedBy: uid, expiresAt });
    tx.set(db.doc(`coupleInvitations/${coupleRef.id}`), { digest });
  });
  return { code, expiresAt };
}

export const createInvitation = onCall(options, async (request) => {
  const uid = await activeUid(request);
  await protectInvitation(request, uid, 'invite');
  return issueInvitation(uid, request.data?.coupleId);
});

export async function acceptInvitation(uid: string, input: unknown) {
  const { code, profile } = parse(z.object({ code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{10}$/), profile: profileSchema }).strict(), input);
  const db = getFirestore();
  const inviteRef = db.doc(`invitations/${hash(code)}`);
  const invalid = () => new HttpsError('failed-precondition', 'Invitation invalide, expirée ou déjà utilisée. Demande un nouveau code à ta moitié.');
  return db.runTransaction(async (tx) => {
    const [invite, user] = await tx.getAll(inviteRef, db.doc(`users/${uid}`));
    const invitation = invite.data();
    if (!invitation || invitation.expiresAt <= Date.now()) throw invalid();
    if (user.data()?.coupleId) throw new HttpsError('already-exists', 'Ce compte est déjà lié à un espace.');
    const coupleRef = db.doc(`couples/${invitation.coupleId}`);
    const [couple, pointer] = await tx.getAll(coupleRef, db.doc(`coupleInvitations/${invitation.coupleId}`));
    const data = couple.data();
    if (!data || data.deletionLock || data.members.length !== 1 || data.members.includes(uid) ||
        data.members[0] !== invitation.invitedBy || pointer.data()?.digest !== inviteRef.id) throw invalid();
    tx.update(coupleRef, { members: [...data.members, uid], [`profiles.${uid}`]: profile });
    tx.set(db.doc(`users/${uid}`), { coupleId: coupleRef.id });
    tx.delete(inviteRef);
    tx.delete(pointer.ref);
    return { coupleId: coupleRef.id };
  });
}

export const joinCouple = onCall(options, async (request) => {
  const uid = await activeUid(request);
  await protectInvitation(request, uid, 'join');
  return acceptInvitation(uid, request.data);
});

export async function submitAnswer(uid: string, input: unknown) {
  const { coupleId, date, text } = parse(z.object({ coupleId: idSchema, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), text: z.string().trim().min(1).max(4000) }).strict(), input);
  // Tolère les fuseaux horaires, mais pas la fabrication d'un historique illimité.
  if (!Number.isFinite(Date.parse(date)) || Math.abs(Date.now() - Date.parse(date)) > 2 * 86_400_000) {
    throw new HttpsError('invalid-argument', 'Cette question n’est plus disponible.');
  }
  const db = getFirestore();
  const coupleRef = db.doc(`couples/${coupleId}`);
  await db.runTransaction(async (tx) => {
    const couple = (await tx.get(coupleRef)).data();
    if (!couple?.members?.includes(uid) || couple.deletionLock) throw new HttpsError('permission-denied', 'Accès refusé.');
    const refs = (couple.members as string[]).map((member) => db.doc(`couples/${coupleId}/private/${member}/answers/${date}`));
    const snapshots = await tx.getAll(...refs);
    const own = snapshots.find((s) => s.ref.parent.parent!.id === uid)!;
    if (own.exists) throw new HttpsError('already-exists', 'Ta réponse est déjà enregistrée.');
    const answer = { date, from: uid, text, createdAt: Date.now() };
    tx.create(own.ref, answer);
    const responses = [...snapshots.filter((s) => s.exists).map((s) => s.data()!), answer];
    const revealed = couple.members.length === 2 && responses.length === 2;
    tx.set(db.doc(`couples/${coupleId}/answerStatus/${date}`), { date, responded: responses.map((a) => a.from), revealed });
    if (revealed) for (const response of responses) {
      tx.set(db.doc(`couples/${coupleId}/revealedAnswers/${date}_${response.from}`), response);
    }
  });
  return { saved: true };
}

export const submitDailyAnswer = onCall(options, async (request) => {
  const uid = await activeUid(request);
  await consumeQuota([{ key: `answers:${uid}`, maximum: 10, windowMs: 3_600_000 }]);
  return submitAnswer(uid, request.data);
});

export const setAiConsent = onCall(options, async (request) => {
  const uid = await activeUid(request);
  const { accepted } = parse(z.object({ accepted: z.boolean(), coupleId: idSchema }).strict(), request.data);
  await memberCouple(uid, request.data.coupleId);
  await getFirestore().doc(`users/${uid}/settings/privacy`).set({ aiConsent: accepted ? AI_CONSENT_VERSION : null, updatedAt: Date.now() }, { merge: true });
  return { accepted };
});

export async function requireAiConsent(uid: string) {
  const consent = await getFirestore().doc(`users/${uid}/settings/privacy`).get();
  if (consent.data()?.aiConsent !== AI_CONSENT_VERSION) {
    throw new HttpsError('failed-precondition', 'Autorise d’abord l’envoi de ta demande à Anthropic.');
  }
}

export const registerPushToken = onCall(options, async (request) => {
  const uid = await activeUid(request);
  await memberCouple(uid, request.data?.coupleId);
  const token = parse(z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/).max(200), request.data?.token);
  await getFirestore().doc(`users/${uid}/devices/${hash(token)}`).set({ token, updatedAt: Date.now() });
  return { registered: true };
});

export const notifyPartner = onCall(options, async (request) => {
  const uid = await activeUid(request);
  const { data } = await memberCouple(uid, request.data?.coupleId);
  const { kind } = parse(z.object({ coupleId: idSchema, kind: z.enum(['note', 'ping', 'answer', 'event']) }).strict(), request.data);
  await consumeQuota([{ key: `push:${uid}`, maximum: 20, windowMs: 3_600_000 }]);
  const partner = (data.members as string[]).find((m) => m !== uid);
  if (!partner) return { sent: false };
  const devices = await getFirestore().collection(`users/${partner}/devices`).get();
  const messages = { note: 'Tu as reçu un mot doux.', ping: 'Ta moitié pense à toi.', answer: 'Ta moitié a répondu à la question du jour.', event: 'Votre agenda a été mis à jour.' };
  const payload = devices.docs.slice(0, 10).map((d) => ({ to: d.data().token, title: 'Nous Deux', body: messages[kind], sound: 'default' }));
  if (!payload.length) return { sent: false };
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new HttpsError('unavailable', 'La notification n’a pas pu être envoyée.');
  const result = await response.json() as { data?: { status: string; details?: { error?: string } }[] };
  await Promise.all((result.data ?? []).map((item, i) => item.details?.error === 'DeviceNotRegistered' ? devices.docs[i].ref.delete() : Promise.resolve()));
  return { sent: (result.data ?? []).some((item) => item.status === 'ok') };
});

/** Prépare la suppression avant toute perte de données. Le journal permet de reprendre après une panne. */
export async function queueDeletion(uid: string, rawId: unknown) {
  const coupleId = parse(idSchema, rawId);
  const db = getFirestore();
  const jobRef = db.doc(`accountDeletions/${uid}`);
  await db.runTransaction(async (tx) => {
    const coupleRef = db.doc(`couples/${coupleId}`);
    const [job, couple] = await tx.getAll(jobRef, coupleRef);
    if (job.exists) {
      if (job.data()?.coupleId !== coupleId) throw new HttpsError('permission-denied', 'Accès refusé.');
      return;
    }
    const data = couple.data();
    if (!data?.members?.includes(uid)) throw new HttpsError('permission-denied', 'Accès refusé.');
    if (data.deletionLock) throw new HttpsError('failed-precondition', 'Une suppression est déjà en cours. Réessaie plus tard.');
    tx.create(jobRef, { coupleId, status: 'pending', createdAt: Date.now(), leaseUntil: 0, remainingMembers: data.members.filter((m: string) => m !== uid) });
    tx.update(coupleRef, { deletionLock: uid });
  });
}

async function removeQuery(query: FirebaseFirestore.Query) {
  for (;;) {
    const snap = await query.limit(200).get();
    if (snap.empty) return;
    const batch = getFirestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** Les anciens fichiers portent le suffixe -uid.jpg ; les nouveaux sont rangés par propriétaire. */
export function ownedPhoto(path: string, coupleId: string, uid: string) {
  return path.startsWith(`couples/${coupleId}/photos/${uid}/`) ||
    (path.startsWith(`couples/${coupleId}/photos/`) && path.endsWith(`-${uid}.jpg`));
}

function photoPath(url: unknown): string {
  if (typeof url !== 'string') return '';
  try { return decodeURIComponent(new URL(url).pathname.split('/o/')[1] ?? ''); } catch { return ''; }
}

export async function completeDeletion(uid: string) {
  const db = getFirestore();
  const jobRef = db.doc(`accountDeletions/${uid}`);
  const lease = randomUUID();
  const job = await db.runTransaction(async (tx) => {
    const data = (await tx.get(jobRef)).data();
    if (!data || data.status === 'complete' || data.leaseUntil > Date.now()) return null;
    tx.update(jobRef, { lease, leaseUntil: Date.now() + 10 * 60_000 });
    return data;
  });
  if (!job) return;
  try {
    const coupleId = job.coupleId as string;
    const coupleRef = db.doc(`couples/${coupleId}`);
    const last = job.remainingMembers.length === 0;
    const bucket = getStorage().bucket();
    // Ne pas ignorer une panne Storage : le compte reste bloqué et la tâche sera reprise.
    let pageToken: string | undefined;
    try {
      do {
        const [files, next] = await bucket.getFiles({ prefix: `couples/${coupleId}/photos/`, autoPaginate: false, maxResults: 200, pageToken });
        await Promise.all(files.filter((f) => last || ownedPhoto(f.name, coupleId, uid)).map((f) => f.delete({ ignoreNotFound: true })));
        pageToken = next?.pageToken;
      } while (pageToken);
    } catch (error) {
      // Un ancien projet peut ne jamais avoir activé Storage. Seule l'absence
      // confirmée du bucket est acceptable ; une panne ou un refus reste bloquant.
      if (Number((error as { code?: number }).code) !== 404 || (await bucket.exists())[0]) throw error;
    }

    const pointer = await db.doc(`coupleInvitations/${coupleId}`).get();
    if (pointer.data()?.digest) await db.doc(`invitations/${pointer.data()!.digest}`).delete();
    await pointer.ref.delete();
    if (last) {
      await db.recursiveDelete(coupleRef);
    } else {
      await db.recursiveDelete(coupleRef.collection('private').doc(uid));
      for (const [collection, field] of [['notes', 'from'], ['answers', 'from'], ['revealedAnswers', 'from'], ['memories', 'createdBy'], ['events', 'who']]) {
        await removeQuery(coupleRef.collection(collection).where(field, '==', uid));
      }
      // Retire les identifiants personnels des éléments partagés conservés.
      for (const [collection, field] of [['events', 'createdBy'], ['restaurants', 'createdBy'], ['items', 'createdBy'], ['expenses', 'paidBy']]) {
        for (;;) {
          const snap = await coupleRef.collection(collection).where(field, '==', uid).limit(200).get();
          if (snap.empty) break;
          const batch = db.batch();
          snap.docs.forEach((d) => batch.update(d.ref, { [field]: 'former-member' }));
          await batch.commit();
        }
      }
      const statuses = await coupleRef.collection('answerStatus').get();
      for (const state of statuses.docs) {
        await state.ref.update({ responded: (state.data().responded ?? []).filter((m: string) => m !== uid) });
      }
      const current = (await coupleRef.get()).data();
      const patch: DocumentData = { members: job.remainingMembers, [`profiles.${uid}`]: FieldValue.delete() };
      if (ownedPhoto(photoPath(current?.photoUrl), coupleId, uid) || String(current?.photoUrl ?? '').startsWith('data:')) {
        patch.photoUrl = FieldValue.delete(); patch.photoFrame = FieldValue.delete();
      }
      await coupleRef.update(patch);
    }
    await db.recursiveDelete(db.doc(`users/${uid}`));
    try { await getAuth().deleteUser(uid); } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    }
    // Le compte est supprimé avant de rouvrir l'espace au membre restant.
    if (!last) await coupleRef.update({ deletionLock: FieldValue.delete() });
    await jobRef.update({ status: 'complete', completedAt: Date.now(), leaseUntil: 0, lease: FieldValue.delete() });
  } catch (error) {
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(jobRef)).data();
      if (current?.lease === lease) tx.update(jobRef, { leaseUntil: 0, lease: FieldValue.delete(), lastFailureAt: Date.now() });
    });
    throw error;
  }
}

export const deleteAccount = onCall({ ...options, timeoutSeconds: 540 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise.');
  const existing = await getFirestore().doc(`accountDeletions/${uid}`).get();
  // Une authentification récente est requise AVANT de commencer, pas en fin de suppression.
  if (!existing.exists && request.auth!.token.firebase?.sign_in_provider !== 'anonymous' &&
      (!Number.isFinite(Number(request.auth!.token.auth_time)) || Date.now() / 1000 - Number(request.auth!.token.auth_time) > 300)) {
    throw new HttpsError('failed-precondition', 'Confirme ton mot de passe avant de supprimer ton compte.');
  }
  await queueDeletion(uid, request.data?.coupleId);
  try { await completeDeletion(uid); } catch { /* Reprise automatique, aucun contenu personnel dans les logs. */ }
  const complete = (await getFirestore().doc(`accountDeletions/${uid}`).get()).data()?.status === 'complete';
  return { status: complete ? 'complete' : 'pending' };
});

export const retryAccountDeletions = onSchedule({ schedule: 'every 60 minutes', region: REGION, timeoutSeconds: 540, maxInstances: 1 }, async () => {
  const pending = await getFirestore().collection('accountDeletions').where('status', '==', 'pending').limit(20).get();
  for (const job of pending.docs) {
    try { await completeDeletion(job.id); } catch { console.error('Account cleanup pending; automatic retry scheduled.'); }
  }
});
