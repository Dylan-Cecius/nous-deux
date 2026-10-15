import { createHash } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { activeUid, consumeQuota, memberCouple, parse } from './security';

const entrySchema = z.object({
  id: z.string().min(1).max(1500).refine((id) => !id.includes('/')),
  amount: z.number().positive().max(100000),
  paidBy: z.string().min(1).max(128),
  kind: z.enum(['expense', 'settle']).default('expense'),
}).strict();
const inputSchema = z.object({
  coupleId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  expectedUserId: z.string().min(1).max(128),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{12,80}$/),
  expected: z.array(entrySchema).max(500).refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length),
}).strict();
type Entry = z.infer<typeof entrySchema>;
const fingerprint = (entries: Entry[]) => createHash('sha256').update(JSON.stringify(
  [...entries].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map((entry) => [entry.id, entry.amount, entry.paidBy, entry.kind]),
)).digest('hex');
const stale = () => new HttpsError('failed-precondition', 'Le relevé a changé. Attends son actualisation avant de marquer le remboursement.');

/** Annotation uniquement : aucun paiement, virement ou prestataire financier. */
export const recordSettlement = onCall({ region: 'europe-west1', maxInstances: 3 }, async (request) => {
  const uid = await activeUid(request);
  if (request.data?.expectedUserId !== uid) {
    throw new HttpsError('failed-precondition', 'Le compte a changé. Rouvre les dépenses avant de réessayer.');
  }
  const input = parse(inputSchema, request.data);
  const { ref: coupleRef } = await memberCouple(uid, input.coupleId);
  await consumeQuota([{ key: `settlements:${uid}`, maximum: 30, windowMs: 3_600_000 }]);
  const db = getFirestore();
  const digest = fingerprint(input.expected);
  const receiptRef = coupleRef.collection('private').doc(uid).collection('settlementRequests').doc(input.requestId);
  const expenseRef = coupleRef.collection('expenses').doc();
  return db.runTransaction(async (tx) => {
    const [couple, receipt] = await tx.getAll(coupleRef, receiptRef);
    const data = couple.data();
    if (!data?.members?.includes(uid)) throw new HttpsError('permission-denied', 'Accès refusé.');
    if (data.deletionLock) throw new HttpsError('failed-precondition', 'Cet espace est temporairement indisponible pendant une suppression.');
    // Rejouer une intention terminée ne recrée rien, même si sa marque a été
    // retirée depuis. Le reçu suit les données privées du demandeur à la suppression.
    if (receipt.exists) {
      if (receipt.data()!.fingerprint !== digest) throw stale();
      return { settlementId: receipt.data()!.settlementId as string };
    }
    const members: string[] = data.members;
    if (members.length !== 2 || new Set(members).size !== 2) {
      throw new HttpsError('failed-precondition', 'Deux membres sont nécessaires pour marquer un remboursement.');
    }
    const snapshot = await tx.get(coupleRef.collection('expenses').limit(501));
    if (snapshot.size > 500) throw new HttpsError('failed-precondition', 'Ce relevé est trop volumineux pour cette opération.');
    const entries = snapshot.docs.map((doc) => {
      const entry = doc.data();
      const parsed = entrySchema.safeParse({ id: doc.id, amount: entry.amount, paidBy: entry.paidBy, kind: entry.kind ?? 'expense' });
      if (!parsed.success || !members.includes(parsed.data.paidBy)) {
        throw new HttpsError('failed-precondition', 'Ce relevé contient une dépense qui ne peut pas être soldée automatiquement.');
      }
      return parsed.data;
    });
    if (fingerprint(entries) !== digest) throw stale();
    // Même arrondi symétrique que src/lib/expenses.ts : les marques comptent
    // en centimes entiers, après le partage du net des dépenses.
    let expenses = 0;
    let settlements = 0;
    for (const entry of entries) {
      const cents = Math.round(entry.amount * 100) * (entry.paidBy === uid ? 1 : -1);
      if (entry.kind === 'settle') settlements += cents;
      else expenses += cents;
    }
    const balance = Math.sign(expenses) * Math.round(Math.abs(expenses) / 2) + settlements;
    if (!Number.isSafeInteger(balance) || balance === 0 || Math.abs(balance) > 10_000_000) {
      throw new HttpsError('failed-precondition', 'Ce solde ne peut pas être marqué comme remboursé.');
    }
    tx.create(expenseRef, {
      title: 'Remboursement', amount: Math.abs(balance) / 100,
      paidBy: balance > 0 ? members.find((member) => member !== uid)! : uid,
      kind: 'settle', createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(receiptRef, { fingerprint: digest, settlementId: expenseRef.id, createdAt: FieldValue.serverTimestamp() });
    // Point de sérialisation commun aux deux membres, sans stocker le relevé
    // dans le document du couple ni accepter un montant calculé par le client.
    tx.update(coupleRef, { expenseSettlementRevision: FieldValue.increment(1) });
    return { settlementId: expenseRef.id };
  });
});
