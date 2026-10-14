import { createHash } from 'node:crypto';
import { FieldValue, getFirestore, type DocumentData } from 'firebase-admin/firestore';

/** Les anciennes écritures doivent être bloquées par les règles v2 avant --apply. */
export async function migrateSecurity(apply = false) {
  const db = getFirestore();
  const couples = await db.collection('couples').get();
  const owners = new Map<string, string>();
  // Préflight complet avant toute écriture : aucun index utilisateur n'est écrasé.
  for (const couple of couples.docs) {
    const data = couple.data();
    if (data.deletionLock || !Array.isArray(data.members) || data.members.length < 1 || data.members.length > 2 || new Set(data.members).size !== data.members.length) {
      throw new Error(`Espace ${couple.id} à vérifier avant migration.`);
    }
    for (const uid of data.members as string[]) {
      if (owners.has(uid)) throw new Error('Un compte appartient à plusieurs espaces. Migration annulée.');
      owners.set(uid, couple.id);
      const profile = data.profiles?.[uid];
      if (!profile || typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 60 || !/^#[0-9a-fA-F]{6}$/.test(profile.color)) {
        throw new Error(`Profil non valide dans ${couple.id}. Migration annulée.`);
      }
      const index = (await db.doc(`users/${uid}`).get()).data();
      if (index?.coupleId && index.coupleId !== couple.id) throw new Error('Index utilisateur incohérent. Migration annulée.');
    }
  }
  let answers = 0;
  let tokens = 0;
  const plans: { ref: FirebaseFirestore.DocumentReference; data: DocumentData; days: Map<string, Map<string, DocumentData>> }[] = [];
  for (const couple of couples.docs) {
    const data = couple.data();
    const old = await couple.ref.collection('answers').get();
    const days = new Map<string, Map<string, DocumentData>>();
    for (const row of old.docs) {
      const a = row.data();
      if (!data.members.includes(a.from)) continue;
      if (typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date) || typeof a.text !== 'string' || !Number.isFinite(a.createdAt)) {
        throw new Error(`Réponse ancienne non valide dans ${couple.id}. Migration annulée.`);
      }
      if (!days.has(a.date)) days.set(a.date, new Map());
      const prior = days.get(a.date)!.get(a.from);
      if (!prior || a.createdAt < prior.createdAt) days.get(a.date)!.set(a.from, { date: a.date, from: a.from, text: a.text, createdAt: a.createdAt });
      answers++;
    }
    tokens += data.members.filter((uid: string) => data.profiles[uid]?.pushToken).length;
    plans.push({ ref: couple.ref, data, days });
  }
  if (apply) for (const { ref, data, days } of plans) {
    for (const [date, legacy] of days) {
      await db.runTransaction(async (tx) => {
        const snapshots = await tx.getAll(...data.members.map((uid: string) => ref.collection('private').doc(uid).collection('answers').doc(date)));
        const responses: DocumentData[] = [];
        for (const snap of snapshots) {
          const existing = snap.data();
          const answer = existing ?? legacy.get(snap.ref.parent.parent!.id);
          if (answer) {
            responses.push(answer);
            if (!existing) tx.create(snap.ref, answer);
          }
        }
        const revealed = data.members.length === 2 && responses.length === 2;
        tx.set(ref.collection('answerStatus').doc(date), { date, responded: responses.map((a) => a.from), revealed });
        if (revealed) for (const answer of responses) tx.set(ref.collection('revealedAnswers').doc(`${date}_${answer.from}`), answer);
      });
    }
    await db.runTransaction(async (tx) => {
      const latest = (await tx.get(ref)).data();
      if (!latest || latest.deletionLock || JSON.stringify(latest.members) !== JSON.stringify(data.members)) throw new Error('Espace modifié pendant la migration. Relancer après vérification.');
      const indexes = await tx.getAll(...(data.members as string[]).map((uid) => db.doc(`users/${uid}`)));
      for (const index of indexes) if (index.data()?.coupleId && index.data()?.coupleId !== ref.id) throw new Error('Index modifié pendant la migration.');
      const patch: DocumentData = { securityVersion: 2 };
      for (const uid of data.members as string[]) {
        const token = latest.profiles[uid]?.pushToken;
        if (typeof token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token)) {
          const id = createHash('sha256').update(token).digest('hex');
          tx.set(db.doc(`users/${uid}/devices/${id}`), { token, updatedAt: Date.now() }, { merge: true });
        }
        if (token !== undefined) patch[`profiles.${uid}.pushToken`] = FieldValue.delete();
        tx.set(db.doc(`users/${uid}`), { coupleId: ref.id }, { merge: true });
      }
      tx.update(ref, patch);
    });
  }
  return { apply, couples: couples.size, accounts: owners.size, legacyAnswers: answers, legacyPushTokens: tokens };
}
