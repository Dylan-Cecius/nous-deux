const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, Timestamp, writeBatch, runTransaction } = require('firebase/firestore');
const { ref, uploadBytes, getBytes } = require('firebase/storage');

const projectId = 'demo-nous-deux-security';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('Ces tests exigent les trois émulateurs. Aucun accès au cloud réel.');
}
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const db = getFirestore();
const security = require('../lib/security');
const { migrateSecurity } = require('../lib/migration');
const { purgeTechnicalData, RETENTION } = require('../lib/retention');
const settlementApi = () => require('../lib/settlements');
const memoryApi = () => require('../lib/memories');
const { createSpace, issueInvitation, acceptInvitation, submitAnswer, consumeQuota, queueDeletion, completeDeletion, requireAiConsent, AI_CONSENT_VERSION } = security;
const profile = { name: 'Test', color: '#abcdef' };
const cid = 'test-couple';
const date = new Date().toISOString().slice(0, 10);
const hash = (s) => createHash('sha256').update(s).digest('hex');
let env;
const client = (uid) => env.authenticatedContext(uid).firestore();
const call = (uid, data, age = 0, provider = 'password') => ({ data, auth: { uid, token: { auth_time: Date.now()/1000 - age, firebase: { sign_in_provider: provider } } }, rawRequest: { ip: '127.0.0.1' } });
async function seed(members = ['alice', 'bob']) {
  await db.doc(`couples/${cid}`).set({ members, profiles: Object.fromEntries(members.map(uid => [uid, profile])), createdAt: Date.now(), securityVersion: 2 });
  for (const uid of members) await db.doc(`users/${uid}`).set({ coupleId: cid });
}
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { rules: readFileSync('../firestore.rules', 'utf8') }, storage: { rules: readFileSync('../storage.rules', 'utf8') } });
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env?.cleanup(); await deleteApp(app); });

const settlementInput = (requestId = 'request-alice-0001', expected = [{ id: 'original', amount: 40, paidBy: 'alice', kind: 'expense' }]) => ({
  coupleId: cid, expectedUserId: 'alice', requestId, expected,
});
const memoryInput = (patch = {}) => ({
  coupleId: cid, expectedUserId: 'alice', requestId: 'memory-alice-0001',
  photoUrl: 'data:image/jpeg;base64,AAAA', caption: 'Souvenir fictif', date: '2026-10-15', ...patch,
});

test('association souvenir : les demandes concurrentes produisent un seul document et reçu', async () => {
  await seed();
  const results = await Promise.all(Array.from({ length: 5 }, () => memoryApi().associateMemory.run(call('alice', memoryInput()))));
  assert.equal(new Set(results.map(result => result.memoryId)).size, 1);
  const memories = await db.collection(`couples/${cid}/memories`).get();
  const receipts = await db.collection(`couples/${cid}/private/alice/memoryRequests`).get();
  assert.equal(memories.size, 1); assert.equal(receipts.size, 1);
  assert.equal(memories.docs[0].data().createdBy, 'alice');
  assert.ok(memories.docs[0].data().createdAt.toMillis() > 0);
  assert.deepEqual(Object.keys(receipts.docs[0].data()).sort(), ['createdAt', 'fingerprint', 'memoryId']);
  assert.match(receipts.docs[0].data().fingerprint, /^[a-f0-9]{64}$/);
});

test('association souvenir : une reprise conserve les éditions puis ne recrée pas une fiche supprimée', async () => {
  await seed();
  const first = await memoryApi().associateMemory.run(call('alice', memoryInput()));
  const path = `couples/${cid}/memories/${first.memoryId}`;
  await assertSucceeds(updateDoc(doc(client('bob'), path), { caption: 'Légende modifiée' }));
  assert.deepEqual(await memoryApi().associateMemory.run(call('alice', memoryInput())), first);
  assert.equal((await db.doc(path).get()).data().caption, 'Légende modifiée');
  await assertSucceeds(deleteDoc(doc(client('bob'), path)));
  assert.deepEqual(await memoryApi().associateMemory.run(call('alice', memoryInput())), first);
  assert.equal((await db.doc(path).get()).exists, false);
});

test('association souvenir : une clé ne peut pas changer de contenu', async () => {
  await seed();
  await memoryApi().associateMemory.run(call('alice', memoryInput()));
  for (const patch of [{ caption: 'Autre' }, { date: '2026-10-16' }, { photoUrl: 'data:image/jpeg;base64,BBBB' }]) {
    await assert.rejects(memoryApi().associateMemory.run(call('alice', memoryInput(patch))), { code: 'failed-precondition' });
  }
  assert.equal((await db.collection(`couples/${cid}/memories`).get()).size, 1);
});

test('association souvenir : identité, appartenance et suppression restent obligatoires', async () => {
  await seed();
  await assert.rejects(memoryApi().associateMemory.run({ data: memoryInput() }), { code: 'unauthenticated' });
  await assert.rejects(memoryApi().associateMemory.run(call('bob', memoryInput())), { code: 'failed-precondition' });
  await assert.rejects(memoryApi().associateMemory.run(call('mallory', memoryInput({ expectedUserId: 'mallory' }))), { code: 'permission-denied' });
  await db.doc(`couples/${cid}`).update({ deletionLock: 'fictitious' });
  await assert.rejects(memoryApi().associateMemory.run(call('alice', memoryInput())), { code: 'failed-precondition' });
  await db.doc(`couples/${cid}`).update({ deletionLock: FieldValue.delete() });
  await db.doc('accountDeletions/alice').set({ status: 'pending' });
  await assert.rejects(memoryApi().associateMemory.run(call('alice', memoryInput())), { code: 'failed-precondition' });
  assert.equal((await db.collection(`couples/${cid}/memories`).get()).size, 0);
});

test('association souvenir : reçus privés inaccessibles et intentions isolées par demandeur', async () => {
  await seed();
  const a = await memoryApi().associateMemory.run(call('alice', memoryInput()));
  const b = await memoryApi().associateMemory.run(call('bob', memoryInput({ expectedUserId: 'bob' })));
  assert.notEqual(a.memoryId, b.memoryId);
  const path = `couples/${cid}/private/alice/memoryRequests/memory-alice-0001`;
  for (const uid of ['alice', 'bob', 'mallory']) {
    await assertFails(getDoc(doc(client(uid), path)));
    await assertFails(setDoc(doc(client(uid), path), { memoryId: 'forged' }));
    await assertFails(deleteDoc(doc(client(uid), path)));
  }
});

test('association souvenir : payloads invalides refusés sans créer de reçu', async () => {
  await seed();
  for (const patch of [{ requestId: '../forged' }, { date: '2026-02-30' }, { caption: 'x'.repeat(4001) }, { createdBy: 'bob' },
    { photoUrl: 'data:image/jpeg;base64,' }, { photoUrl: 'data:image/svg+xml;base64,AAAA' }, { photoUrl: 'data:image/jpeg;base64,A===' },
    { photoUrl: `data:image/jpeg;base64,${'A'.repeat(600000)}` }]) {
    await assert.rejects(memoryApi().associateMemory.run(call('alice', memoryInput(patch))), { code: 'invalid-argument' });
  }
  assert.equal((await db.collection(`couples/${cid}/private/alice/memoryRequests`).get()).size, 0);
  assert.equal((await db.collection(`couples/${cid}/memories`).get()).size, 0);
});

test('association souvenir : limite existante anti-abus appliquée avant toute création', async () => {
  await seed();
  await db.doc(`rateLimits/${hash('memory-associations:alice')}`).set({ count: 30, resetAt: Date.now() + 60000 });
  await assert.rejects(memoryApi().associateMemory.run(call('alice', memoryInput())), { code: 'resource-exhausted' });
  assert.equal((await db.collection(`couples/${cid}/memories`).get()).size, 0);
});

test('association souvenir : un reçu ne dispense jamais de vérifier l’appartenance actuelle', async () => {
  await seed();
  await memoryApi().associateMemory.run(call('alice', memoryInput()));
  await db.doc(`couples/${cid}`).update({ members: ['bob'] });
  await assert.rejects(memoryApi().associateMemory.run(call('alice', memoryInput())), { code: 'permission-denied' });
  assert.equal((await db.collection(`couples/${cid}/memories`).get()).size, 1);
});

test('association souvenir : appartenance et verrou sont revérifiés dans la transaction finale', async () => {
  for (const patch of [{ members: ['bob'] }, { deletionLock: 'fictitious-lock' }]) {
    await seed();
    let transactions = 0;
    const original = db.runTransaction;
    db.runTransaction = async function (...args) {
      transactions += 1;
      if (transactions === 2) await db.doc(`couples/${cid}`).update(patch);
      return original.apply(this, args);
    };
    try {
      await assert.rejects(memoryApi().associateMemory.run(call('alice', memoryInput())), { code: patch.members ? 'permission-denied' : 'failed-precondition' });
    } finally { db.runTransaction = original; }
    assert.equal((await db.collection(`couples/${cid}/memories`).get()).size, 0);
    assert.equal((await db.collection(`couples/${cid}/private/alice/memoryRequests`).get()).size, 0);
  }
});

test('association souvenir : le repli compact proche du plafond reste borné et accepté', async () => {
  await seed();
  const photoUrl = `data:image/jpeg;base64,${'A'.repeat(599996)}`;
  assert.equal(photoUrl.length, 600019);
  const result = await memoryApi().associateMemory.run(call('alice', memoryInput({ photoUrl })));
  assert.equal((await db.doc(`couples/${cid}/memories/${result.memoryId}`).get()).data().photoUrl, photoUrl);
  await assert.rejects(memoryApi().associateMemory.run(call('alice', memoryInput({ requestId: 'memory-alice-0002', photoUrl: photoUrl + 'AAAA' }))), { code: 'invalid-argument' });
});

const storagePhotoUrl = (path, token = 'fictitious-token', bucket = getStorage().bucket().name) =>
  `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

test('association souvenir : vérifie le fichier propre, puis rejoue même après retrait du fichier', async () => {
  await seed();
  const path = `couples/${cid}/photos/alice/association.jpg`;
  const file = getStorage().bucket().file(path);
  await file.save(Buffer.from([1, 2, 3]), { metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: 'fictitious-token' } } });
  try {
    const input = memoryInput({ photoUrl: storagePhotoUrl(path) });
    const first = await memoryApi().associateMemory.run(call('alice', input));
    assert.equal((await db.doc(`couples/${cid}/memories/${first.memoryId}`).get()).data().photoUrl, input.photoUrl);
    await file.delete();
    assert.deepEqual(await memoryApi().associateMemory.run(call('alice', input)), first);
  } finally { await file.delete({ ignoreNotFound: true }); }
});

test('association souvenir : refuse les URL externes, les autres buckets et les photos du partenaire', async () => {
  await seed();
  const ownPath = `couples/${cid}/photos/alice/fake.jpg`;
  for (const photoUrl of ['https://example.com/photo.jpg', 'file:///private/photo.jpg',
    storagePhotoUrl(`couples/${cid}/photos/bob/fake.jpg`), storagePhotoUrl('couples/foreign/photos/alice/fake.jpg'),
    storagePhotoUrl(ownPath, 'fictitious-token', 'other-bucket'), storagePhotoUrl(ownPath) + '&token=duplicate',
    storagePhotoUrl(ownPath) + '#fragment', storagePhotoUrl(ownPath).replace('https:', 'http:')]) {
    await assert.rejects(memoryApi().associateMemory.run(call('alice', memoryInput({ photoUrl }))), { code: 'invalid-argument' });
  }
  assert.equal((await db.collection(`couples/${cid}/memories`).get()).size, 0);
});

test('association souvenir : refuse fichier absent, vide, non image et jeton erroné', async () => {
  await seed();
  const path = `couples/${cid}/photos/alice/invalid-association.jpg`;
  const file = getStorage().bucket().file(path);
  const input = memoryInput({ photoUrl: storagePhotoUrl(path) });
  await assert.rejects(memoryApi().associateMemory.run(call('alice', input)), { code: 'failed-precondition' });
  try {
    for (const [bytes, contentType, token] of [[[], 'image/jpeg', 'fictitious-token'], [[1], 'text/plain', 'fictitious-token'], [[1], 'image/jpeg', 'wrong-token']]) {
      await file.save(Buffer.from(bytes), { metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } });
      await assert.rejects(memoryApi().associateMemory.run(call('alice', input)), { code: 'invalid-argument' });
    }
    assert.equal((await db.collection(`couples/${cid}/memories`).get()).size, 0);
    assert.equal((await db.collection(`couples/${cid}/private/alice/memoryRequests`).get()).size, 0);
  } finally { await file.delete({ ignoreNotFound: true }); }
});
async function seedExpense() {
  await seed();
  await db.doc(`couples/${cid}/expenses/original`).set({ title: 'Dépense fictive', amount: 40, paidBy: 'alice', createdAt: Date.now() });
}

test('les anciennes écritures directes de marques sont refusées pour les deux membres', async () => {
  await seedExpense();
  const data = { title: 'Marque fictive', amount: 20, paidBy: 'bob', kind: 'settle', createdAt: serverTimestamp() };
  await Promise.all([
    assertFails(setDoc(doc(client('alice'), `couples/${cid}/expenses/legacy-a`), data)),
    assertFails(setDoc(doc(client('bob'), `couples/${cid}/expenses/legacy-b`), data)),
  ]);
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 1);
});

test('une dépense ordinaire ne peut pas être convertie en marque par mise à jour ou remplacement', async () => {
  await seedExpense();
  const ref = doc(client('alice'), `couples/${cid}/expenses/original`);
  await assertFails(updateDoc(ref, { kind: 'settle' }));
  await assertFails(setDoc(ref, { title: 'Fictif', amount: 20, paidBy: 'bob', kind: 'settle', createdAt: serverTimestamp() }));
  assert.equal((await db.doc(`couples/${cid}/expenses/original`).get()).data().kind, undefined);
});

test('une marque serveur ne peut pas être altérée ni déguisée en dépense ordinaire', async () => {
  await seedExpense();
  const { settlementId } = await settlementApi().recordSettlement.run(call('alice', settlementInput()));
  const ref = doc(client('bob'), `couples/${cid}/expenses/${settlementId}`);
  await assertFails(updateDoc(ref, { amount: 99 }));
  await assertFails(updateDoc(ref, { kind: 'expense' }));
  await assertFails(setDoc(ref, { title: 'Fictif', amount: 20, paidBy: 'bob', createdAt: serverTimestamp() }));
  assert.equal((await db.doc(`couples/${cid}/expenses/${settlementId}`).get()).data().amount, 20);
});

test('les marques serveur restent lisibles et retirables par les membres uniquement', async () => {
  await seedExpense();
  const { settlementId } = await settlementApi().recordSettlement.run(call('alice', settlementInput()));
  const path = `couples/${cid}/expenses/${settlementId}`;
  for (const uid of ['alice', 'bob']) await assertSucceeds(getDoc(doc(client(uid), path)));
  await assertFails(getDoc(doc(client('mallory'), path)));
  await assertFails(deleteDoc(doc(client('mallory'), path)));
  await db.doc(`couples/${cid}`).update({ deletionLock: 'alice' });
  await assertFails(deleteDoc(doc(client('alice'), path)));
  await db.doc(`couples/${cid}`).update({ deletionLock: FieldValue.delete() });
  await assertSucceeds(deleteDoc(doc(client('bob'), path)));
  assert.equal((await db.doc(path).get()).exists, false);
});

test('les dépenses ordinaires anciennes et explicites restent modifiables sans pouvoir forger une marque', async () => {
  await seedExpense();
  const alice = client('alice');
  await assertSucceeds(updateDoc(doc(alice, `couples/${cid}/expenses/original`), { amount: 41 }));
  const ref = doc(alice, `couples/${cid}/expenses/new`);
  await assertSucceeds(setDoc(ref, { title: 'Fictif', amount: 10, paidBy: 'bob', kind: 'expense', createdAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { title: 'Autre fictif', amount: 12 }));
  await assertFails(updateDoc(ref, { kind: 'unknown' }));
  await assertSucceeds(deleteDoc(ref));
});

test('une marque transactionnelle calcule le solde côté serveur et conserve un reçu privé minimal', async () => {
  await seedExpense();
  const { settlementId } = await settlementApi().recordSettlement.run(call('alice', settlementInput()));
  const saved = (await db.doc(`couples/${cid}/expenses/${settlementId}`).get()).data();
  assert.equal(saved.amount, 20);
  assert.equal(saved.paidBy, 'bob');
  assert.equal(saved.kind, 'settle');
  const receiptPath = `couples/${cid}/private/alice/settlementRequests/request-alice-0001`;
  const receipt = (await db.doc(receiptPath).get()).data();
  assert.deepEqual(Object.keys(receipt).sort(), ['createdAt', 'fingerprint', 'settlementId']);
  for (const uid of ['alice', 'bob', 'mallory']) await assertFails(getDoc(doc(client(uid), receiptPath)));
});

test('deux appareils ne peuvent pas solder deux fois le même relevé', async () => {
  await seedExpense();
  const results = await Promise.allSettled([
    settlementApi().recordSettlement.run(call('alice', settlementInput())),
    settlementApi().recordSettlement.run(call('bob', { ...settlementInput('request-bob-000001'), expectedUserId: 'bob' })),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === 'failed-precondition').length, 1);
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 2);
});

test('rejouer la même intention après réponse perdue ne recrée pas la marque, même si elle a ensuite été supprimée', async () => {
  await seedExpense();
  const input = settlementInput();
  const first = await settlementApi().recordSettlement.run(call('alice', input));
  const retry = await settlementApi().recordSettlement.run(call('alice', input));
  assert.deepEqual(retry, first);
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 2);
  await db.doc(`couples/${cid}/expenses/${first.settlementId}`).delete();
  assert.deepEqual(await settlementApi().recordSettlement.run(call('alice', input)), first);
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 1);
  const renewed = await settlementApi().recordSettlement.run(call('alice', settlementInput('request-alice-0002')));
  assert.notEqual(renewed.settlementId, first.settlementId);
});

test('un reçu ne peut pas être réutilisé avec une autre intention', async () => {
  await seedExpense();
  await settlementApi().recordSettlement.run(call('alice', settlementInput()));
  const changed = settlementInput('request-alice-0001', [{ id: 'original', amount: 80, paidBy: 'alice', kind: 'expense' }]);
  await assert.rejects(settlementApi().recordSettlement.run(call('alice', changed)), { code: 'failed-precondition' });
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 2);
});

test('un relevé modifié, retiré ou complété est refusé sans écriture de marque ni reçu', async () => {
  for (const change of ['update', 'remove', 'append']) {
    await env.clearFirestore(); await seedExpense();
    if (change === 'update') await db.doc(`couples/${cid}/expenses/original`).update({ amount: 80 });
    if (change === 'remove') await db.doc(`couples/${cid}/expenses/original`).delete();
    if (change === 'append') await db.doc(`couples/${cid}/expenses/extra`).set({ amount: 10, paidBy: 'bob' });
    await assert.rejects(settlementApi().recordSettlement.run(call('alice', settlementInput())), { code: 'failed-precondition' });
    assert.equal((await db.collection(`couples/${cid}/private/alice/settlementRequests`).get()).size, 0);
  }
});

test('l’identité, l’appartenance et le verrou de suppression sont contrôlés pour les marques', async () => {
  await seedExpense();
  await assert.rejects(settlementApi().recordSettlement.run(call('bob', settlementInput())), { code: 'failed-precondition' });
  await assert.rejects(settlementApi().recordSettlement.run(call('mallory', { ...settlementInput(), expectedUserId: 'mallory' })), { code: 'permission-denied' });
  await db.doc(`couples/${cid}`).update({ deletionLock: 'alice' });
  await assert.rejects(settlementApi().recordSettlement.run(call('alice', settlementInput())), { code: 'failed-precondition' });
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 1);
});

test('le protocole refuse les doublons d’identifiants, montants invalides et relevés trop grands', async () => {
  await seedExpense();
  const item = settlementInput().expected[0];
  for (const expected of [[item, item], [{ ...item, amount: -1 }], [{ ...item, amount: NaN }], Array.from({ length: 501 }, (_, i) => ({ ...item, id: String(i) }))]) {
    await assert.rejects(settlementApi().recordSettlement.run(call('alice', { ...settlementInput(), expected })), { code: 'invalid-argument' });
  }
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 1);
});

test('les demi-centimes sont cohérents et un solde nul ne crée aucune marque', async () => {
  await seedExpense();
  await db.doc(`couples/${cid}/expenses/original`).update({ amount: 10.31 });
  const expected = [{ ...settlementInput().expected[0], amount: 10.31 }];
  const first = await settlementApi().recordSettlement.run(call('alice', settlementInput('request-alice-0001', expected)));
  const mark = (await db.doc(`couples/${cid}/expenses/${first.settlementId}`).get()).data();
  assert.equal(mark.amount, 5.16);
  const next = [...expected, { id: first.settlementId, amount: mark.amount, paidBy: mark.paidBy, kind: mark.kind }];
  await assert.rejects(settlementApi().recordSettlement.run(call('bob', { ...settlementInput('request-bob-000001', next), expectedUserId: 'bob' })), { code: 'failed-precondition' });
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 2);
});

test('la même intention simultanée rend le même reçu et une seule marque', async () => {
  await seedExpense();
  const results = await Promise.all([
    settlementApi().recordSettlement.run(call('alice', settlementInput())),
    settlementApi().recordSettlement.run(call('alice', settlementInput())),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 2);
  assert.equal((await db.doc(`couples/${cid}`).get()).data().expenseSettlementRevision, 1);
});

test('les reçus et le compteur transactionnel ne sont pas falsifiables par un client', async () => {
  await seedExpense();
  await settlementApi().recordSettlement.run(call('alice', settlementInput()));
  const receipt = doc(client('alice'), `couples/${cid}/private/alice/settlementRequests/request-alice-0001`);
  await assertFails(updateDoc(receipt, { fingerprint: 'forged' }));
  await assertFails(deleteDoc(receipt));
  await assertFails(setDoc(doc(client('alice'), `couples/${cid}/private/alice/settlementRequests/another-request`), { settlementId: 'forged' }));
  await assertFails(updateDoc(doc(client('alice'), 'couples', cid), { expenseSettlementRevision: 0 }));
  await assertSucceeds(updateDoc(doc(client('alice'), 'couples', cid), { since: date }));
});

test('la marque reste symétrique depuis le débiteur et indépendante de l’ordre des lignes', async () => {
  await seedExpense();
  await db.doc(`couples/${cid}/expenses/extra`).set({ amount: 0.31, paidBy: 'bob', title: 'Fictif' });
  const expected = [{ id: 'extra', amount: 0.31, paidBy: 'bob', kind: 'expense' }, ...settlementInput().expected];
  const { settlementId } = await settlementApi().recordSettlement.run(call('bob', { ...settlementInput('request-bob-000001', expected), expectedUserId: 'bob' }));
  const mark = (await db.doc(`couples/${cid}/expenses/${settlementId}`).get()).data();
  assert.equal(mark.amount, 19.85);
  assert.equal(mark.paidBy, 'bob');
  const retry = await settlementApi().recordSettlement.run(call('bob', { ...settlementInput('request-bob-000001', expected.reverse()), expectedUserId: 'bob' }));
  assert.equal(retry.settlementId, settlementId);
});

test('les anciens payeurs et les relevés stockés trop grands sont refusés sans modification', async () => {
  await seedExpense();
  await db.doc(`couples/${cid}/expenses/original`).update({ paidBy: 'former-member' });
  const expected = [{ ...settlementInput().expected[0], paidBy: 'former-member' }];
  await assert.rejects(settlementApi().recordSettlement.run(call('alice', settlementInput('request-alice-0001', expected))), { code: 'failed-precondition' });
  await db.doc(`couples/${cid}/expenses/original`).update({ paidBy: 'alice' });
  const batch = db.batch();
  for (let i = 0; i < 500; i++) batch.set(db.doc(`couples/${cid}/expenses/item-${i}`), { amount: 1, paidBy: 'alice' });
  await batch.commit();
  await assert.rejects(settlementApi().recordSettlement.run(call('alice', settlementInput())), { code: 'failed-precondition' });
  assert.equal((await db.collection(`couples/${cid}/private/alice/settlementRequests`).get()).size, 0);
  assert.equal((await db.collection(`couples/${cid}/expenses`).get()).size, 501);
});

test('un appel sans authentification ou sans identité confirmée est refusé avant tout quota', async () => {
  await seedExpense();
  await assert.rejects(settlementApi().recordSettlement.run({ data: settlementInput() }), { code: 'unauthenticated' });
  const input = settlementInput(); delete input.expectedUserId;
  await assert.rejects(settlementApi().recordSettlement.run(call('alice', input)), { code: 'failed-precondition' });
  assert.equal((await db.collection('rateLimits').get()).size, 0);
});

test('création et jonction refusent une identité différente avant tout quota ou rattachement', async () => {
  await seed(['alice']);
  const { code } = await issueInvitation('alice', cid);
  for (const name of ['createCouple', 'joinCouple']) {
    for (const expectedUserId of ['alice', '', null, 42]) {
      await assert.rejects(security[name].run(call('bob', { profile, code, expectedUserId })), { code: 'failed-precondition' });
    }
  }
  assert.equal((await db.collection('rateLimits').get()).size, 0);
  assert.equal((await db.doc('users/bob').get()).exists, false);
  assert.equal((await db.collection('couples').get()).size, 1);
  assert.deepEqual((await db.doc(`couples/${cid}`).get()).data().members, ['alice']);
  assert.equal((await db.doc(`invitations/${hash(code)}`).get()).exists, true);
});

test('création et jonction acceptent l’identité confirmée et restent compatibles avec les anciens clients', async () => {
  for (const legacy of [false, true]) {
    const creator = `creator-${legacy}`;
    const partner = `partner-${legacy}`;
    const { coupleId } = await security.createCouple.run(call(creator, { profile, ...(legacy ? {} : { expectedUserId: creator }) }));
    const { code } = await issueInvitation(creator, coupleId);
    assert.deepEqual(await security.joinCouple.run(call(partner, { code, profile, ...(legacy ? {} : { expectedUserId: partner }) })), { coupleId });
    assert.deepEqual((await db.doc(`couples/${coupleId}`).get()).data().members, [creator, partner]);
    assert.equal((await db.doc(`users/${partner}`).get()).data().coupleId, coupleId);
  }
});

test('un visiteur et un tiers connecté ne lisent ni les espaces incomplets ni les données privées', async () => {
  await seed(['alice']);
  await assertFails(getDoc(doc(client('mallory'), 'couples', cid)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'couples', cid)));
  await assertFails(getDocs(collection(client('alice'), 'couples')));
  await assertSucceeds(getDoc(doc(client('alice'), 'couples', cid)));
  await assertFails(getDoc(doc(client('mallory'), 'users', 'alice')));
});

test('la création, les membres et les index ne sont modifiables que par le serveur', async () => {
  await seed();
  const alice = client('alice');
  await assertFails(setDoc(doc(alice, 'couples', 'hacked'), { members: ['alice'] }));
  await assertFails(updateDoc(doc(alice, 'couples', cid), { members: ['alice', 'mallory'] }));
  await assertFails(setDoc(doc(alice, 'users', 'alice'), { coupleId: 'foreign' }));
  await assertFails(deleteDoc(doc(alice, 'couples', cid)));
  await assertFails(getDoc(doc(alice, 'invitations', 'guess')));
  await assertFails(getDoc(doc(alice, 'users/alice/devices/token')));
});

test('on peut modifier son profil mais pas celui du partenaire ni y ajouter un secret', async () => {
  await seed();
  const couple = doc(client('alice'), 'couples', cid);
  await assertSucceeds(updateDoc(couple, { 'profiles.alice.name': 'Alice', since: '2024-02-14' }));
  await assertFails(updateDoc(couple, { 'profiles.bob.name': 'Faux' }));
  await assertFails(updateDoc(couple, { 'profiles.alice.pushToken': 'secret' }));
  await assertFails(updateDoc(couple, { 'profiles.alice.name': 'x'.repeat(61) }));
  await assertSucceeds(updateDoc(couple, { photoFrame: { x: 0.5, y: 0.5, zoom: 2 } }));
});

test('les cadeaux et réponses privées sont isolés et les anciens accès aux réponses sont fermés', async () => {
  await seed();
  const gift = `couples/${cid}/private/alice/gifts/one`;
  await assertSucceeds(setDoc(doc(client('alice'), gift), { title: 'Surprise', done: false, createdBy: 'alice', createdAt: Date.now() }));
  await assertFails(getDoc(doc(client('bob'), gift)));
  await assertFails(setDoc(doc(client('bob'), gift), { title: 'Espion', done: false, createdBy: 'bob', createdAt: Date.now() }));
  await assertFails(getDocs(collection(client('alice'), `couples/${cid}/answers`)));
  await assertFails(setDoc(doc(client('alice'), `couples/${cid}/private/alice/answers/${date}`), { text: 'direct' }));
});

test('les notes ne permettent pas d’usurper un auteur et les modifications partagées restent possibles', async () => {
  await seed();
  const alice = client('alice');
  const note = doc(alice, `couples/${cid}/notes/one`);
  await assertFails(setDoc(note, { text: 'Faux', from: 'bob', createdAt: Date.now() }));
  await assertSucceeds(setDoc(note, { text: 'Coucou', from: 'alice', createdAt: Date.now() }));
  await assertFails(updateDoc(doc(client('bob'), note.path), { text: 'Modifié' }));
  await assertFails(updateDoc(note, { admin: true }));
  const path = `couples/${cid}/events/one`;
  await assertSucceeds(setDoc(doc(alice, path), { title: 'Sortie', date, start: '10:00', end: '12:00', who: 'both', kind: 'ensemble', createdBy: 'alice' }));
  await assertSucceeds(updateDoc(doc(client('bob'), path), { title: 'Sortie à deux' }));
  await assertFails(updateDoc(doc(client('bob'), path), { createdBy: 'bob' }));
  await assertFails(updateDoc(doc(client('bob'), path), { start: '25:00' }));
  await assertFails(getDoc(doc(client('mallory'), path)));
});

test('la suppression groupée de 52 horaires est atomique et refuse tout accès à un autre couple', async () => {
  await seed();
  await db.doc('couples/foreign').set({ members: ['mallory'], profiles: { mallory: profile }, securityVersion: 2 });
  const event = { title: 'Horaire fictif', date, start: '09:00', end: '12:00', who: 'both', kind: 'travail', createdBy: 'alice' };
  const paths = Array.from({ length: 52 }, (_, i) => `couples/${cid}/events/${i}`);
  const keep = `couples/${cid}/events/keep`;
  const foreign = 'couples/foreign/events/one';
  const setup = db.batch();
  for (const path of [...paths, keep, foreign]) setup.set(db.doc(path), event);
  await setup.commit();
  const alice = client('alice');
  const denied = writeBatch(alice);
  denied.delete(doc(alice, paths[0]));
  denied.delete(doc(alice, foreign));
  await assertFails(denied.commit());
  assert.equal((await db.doc(paths[0]).get()).exists, true);
  assert.equal((await db.doc(foreign).get()).exists, true);
  const allowed = writeBatch(alice);
  for (const path of paths) allowed.delete(doc(alice, path));
  await assertSucceeds(allowed.commit());
  const remaining = await db.collection(`couples/${cid}/events`).get();
  assert.deepEqual(remaining.docs.map((item) => item.id), ['keep']);
  assert.equal((await db.doc(foreign).get()).exists, true);
});

test('un panier transactionnel de 100 articles est autorisé, un accès tiers ne supprime rien', async () => {
  await seed();
  await db.doc('couples/foreign').set({ members: ['mallory'], profiles: { mallory: profile }, securityVersion: 2 });
  const row = { list: 'shopping', title: 'Article fictif', done: true, createdBy: 'alice', createdAt: Date.now() };
  const paths = Array.from({ length: 100 }, (_, i) => `couples/${cid}/items/${i}`);
  const foreign = 'couples/foreign/items/one';
  const setup = db.batch();
  for (const path of [...paths, foreign]) setup.set(db.doc(path), row);
  await setup.commit();
  const alice = client('alice');
  await assertFails(runTransaction(alice, async (tx) => {
    const snapshots = await Promise.all([paths[0], foreign].map((path) => tx.get(doc(alice, path))));
    snapshots.forEach((snap) => tx.delete(snap.ref));
  }));
  assert.equal((await db.doc(paths[0]).get()).exists, true);
  await assertSucceeds(runTransaction(alice, async (tx) => {
    const snapshots = await Promise.all(paths.map((path) => tx.get(doc(alice, path))));
    snapshots.forEach((snap) => tx.delete(snap.ref));
  }));
  assert.equal((await db.collection(`couples/${cid}/items`).get()).size, 0);
  assert.equal((await db.doc(foreign).get()).exists, true);
});

test('une course décochée pendant la transaction reste présente après réévaluation', async () => {
  await seed();
  const row = { list: 'shopping', title: 'Article fictif', done: true, createdBy: 'alice', createdAt: Date.now() };
  const paths = ['keep', 'remove'].map((id) => `couples/${cid}/items/${id}`);
  await Promise.all(paths.map((path) => db.doc(path).set(row)));
  const alice = client('alice');
  let attempts = 0;
  await assertSucceeds(runTransaction(alice, async (tx) => {
    const snapshots = await Promise.all(paths.map((path) => tx.get(doc(alice, path))));
    if (++attempts === 1) await db.doc(paths[0]).update({ done: false });
    for (const snap of snapshots) {
      const item = snap.data();
      if (item?.list === 'shopping' && item.done === true) tx.delete(snap.ref);
    }
  }));
  assert.ok(attempts >= 2);
  assert.equal((await db.doc(paths[0]).get()).data().done, false);
  assert.equal((await db.doc(paths[1]).get()).exists, false);
});

test('l’heure serveur permet les écritures malgré une horloge client en avance, sans accepter les dates futures', async () => {
  await seed();
  const alice = client('alice');
  const note = doc(alice, `couples/${cid}/notes/server-time`);
  const data = { text: 'Heure serveur', from: 'alice', kind: 'note' };
  const future = Date.now() + 3600000;
  await assertFails(setDoc(note, { ...data, createdAt: future }));
  await assertFails(setDoc(note, { ...data, createdAt: Timestamp.fromMillis(future) }));
  await assertSucceeds(setDoc(note, { ...data, createdAt: serverTimestamp() }));
  const saved = (await getDoc(note)).data().createdAt;
  assert.ok(saved instanceof Timestamp);
  await assertSucceeds(updateDoc(note, { text: 'Modifié' }));
  await assertFails(updateDoc(note, { createdAt: Timestamp.fromMillis(saved.toMillis() - 1000) }));
});

test('les listes, souvenirs et dépenses valident les champs sans bloquer les usages normaux', async () => {
  await seed();
  const alice = client('alice');
  const rows = {
    restaurants: { name: 'Resto', status: 'envie', createdBy: 'alice', createdAt: Date.now() },
    items: { list: 'films', title: 'Film', done: false, createdBy: 'alice', createdAt: Date.now() },
    dates: { title: 'Anniversaire', date, emoji: '🎂', yearly: true },
    memories: { photoUrl: 'data:image/jpeg;base64,AAAA', date, createdBy: 'alice', createdAt: Date.now() },
    expenses: { title: 'Repas', amount: 20, paidBy: 'alice', createdAt: Date.now() },
  };
  for (const [col, row] of Object.entries(rows)) {
    const item = doc(alice, `couples/${cid}/${col}/one`);
    await assertSucceeds(setDoc(item, row));
    await assertFails(updateDoc(item, { unexpected: 'payload' }));
    await assertSucceeds(getDoc(doc(client('bob'), item.path)));
  }
  await assertSucceeds(updateDoc(doc(client('bob'), `couples/${cid}/items/one`), { done: true }));
  await assertFails(updateDoc(doc(alice, `couples/${cid}/expenses/one`), { amount: -1 }));
});

test('les patches de souvenir conservent les champs du partenaire et refusent un tiers', async () => {
  await seed();
  const path = `couples/${cid}/memories/partial`;
  const original = { photoUrl: 'data:image/jpeg;base64,AAAA', caption: 'Légende fictive', date: '2020-01-02', createdBy: 'alice', createdAt: Date.now() };
  await assertSucceeds(setDoc(doc(client('alice'), path), original));
  await assertSucceeds(updateDoc(doc(client('bob'), path), { date: '2021-02-03' }));
  await assertSucceeds(updateDoc(doc(client('alice'), path), { caption: 'Nouvelle légende' }));
  assert.deepEqual((await getDoc(doc(client('bob'), path))).data(), { ...original, date: '2021-02-03', caption: 'Nouvelle légende' });
  await assertFails(updateDoc(doc(client('mallory'), path), { caption: 'Interdit' }));
  await assertFails(updateDoc(doc(client('bob'), path), { createdBy: 'bob' }));
});

test('les patches de listes préservent détails, type et statut coché', async () => {
  await seed();
  for (const list of ['bucket', 'shopping', 'films']) {
    const path = `couples/${cid}/items/${list}`;
    const original = { list, title: 'Titre fictif', detail: 'Ancien détail', done: false, createdBy: 'alice', createdAt: Date.now(), ...(list === 'films' ? { media: 'film' } : {}) };
    await assertSucceeds(setDoc(doc(client('alice'), path), original));
    const partnerPatch = { detail: 'Détail du partenaire', done: true, ...(list === 'films' ? { media: 'serie' } : {}) };
    await assertSucceeds(updateDoc(doc(client('bob'), path), partnerPatch));
    await assertSucceeds(updateDoc(doc(client('alice'), path), { title: 'Nouveau titre' }));
    assert.deepEqual((await getDoc(doc(client('bob'), path))).data(), { ...original, ...partnerPatch, title: 'Nouveau titre' });
    await assertFails(updateDoc(doc(client('mallory'), path), { title: 'Interdit' }));
  }
});

test('les patches de restaurant préservent note, métadonnées et auteur', async () => {
  await seed();
  const path = `couples/${cid}/restaurants/partial`;
  const original = { name: 'Restaurant fictif', status: 'envie', rating: 0, address: 'Adresse fictive', mapsUrl: 'https://maps.google.com/?cid=1', photoUrl: '', createdBy: 'alice', createdAt: Date.now() };
  await assertSucceeds(setDoc(doc(client('alice'), path), original));
  await assertSucceeds(updateDoc(doc(client('bob'), path), { status: 'favori', rating: 5, cuisine: 'Italien' }));
  await assertSucceeds(updateDoc(doc(client('alice'), path), { name: 'Nouveau nom' }));
  assert.deepEqual((await getDoc(doc(client('bob'), path))).data(), { ...original, name: 'Nouveau nom', status: 'favori', rating: 5, cuisine: 'Italien' });
  await assertSucceeds(updateDoc(doc(client('bob'), path), { rating: 0 }));
  await assertFails(updateDoc(doc(client('mallory'), path), { name: 'Interdit' }));
  await assertFails(updateDoc(doc(client('bob'), path), { createdBy: 'bob' }));
});

test('les patches d’agenda préservent les heures reçues et la série', async () => {
  await seed();
  const path = `couples/${cid}/events/partial`;
  const original = { title: 'Horaire fictif', date: '2026-10-15', start: '09:00', end: '12:00', who: 'alice', kind: 'travail', seriesId: 'serie-fictive', createdBy: 'alice' };
  await assertSucceeds(setDoc(doc(client('alice'), path), original));
  await assertSucceeds(updateDoc(doc(client('bob'), path), { start: '10:00', end: '14:00', who: 'both' }));
  await assertSucceeds(updateDoc(doc(client('alice'), path), { title: 'Autre titre' }));
  assert.deepEqual((await getDoc(doc(client('bob'), path))).data(), { ...original, title: 'Autre titre', start: '10:00', end: '14:00', who: 'both' });
  await assertFails(updateDoc(doc(client('alice'), path), { start: '15:00' }));
  await assertFails(updateDoc(doc(client('mallory'), path), { title: 'Interdit' }));
  await assertFails(updateDoc(doc(client('bob'), path), { createdBy: 'bob' }));
});

test('les patches privés de cadeaux restent réservés au propriétaire', async () => {
  await seed();
  const path = `couples/${cid}/private/alice/gifts/partial`;
  const original = { title: 'Cadeau fictif', detail: 'Détail privé fictif', done: true, createdBy: 'alice', createdAt: Date.now() };
  await assertSucceeds(setDoc(doc(client('alice'), path), original));
  await assertSucceeds(updateDoc(doc(client('alice'), path), { title: 'Autre titre' }));
  assert.deepEqual((await getDoc(doc(client('alice'), path))).data(), { ...original, title: 'Autre titre' });
  await assertFails(updateDoc(doc(client('bob'), path), { title: 'Interdit' }));
  await assertFails(getDoc(doc(client('bob'), path)));
  await assertFails(updateDoc(doc(client('alice'), path), { createdBy: 'bob' }));
});

test('Storage limite les fichiers au propriétaire, aux membres, aux images et à leur taille', async () => {
  await seed();
  const path = `couples/${cid}/photos/alice/secure-test.jpg`;
  const alice = env.authenticatedContext('alice').storage();
  const bob = env.authenticatedContext('bob').storage();
  const mallory = env.authenticatedContext('mallory').storage();
  await assertFails(uploadBytes(ref(bob, path), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(alice, path), new Uint8Array([1]), { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(alice, path), new Uint8Array(10 * 1024 * 1024), { contentType: 'image/jpeg' }));
  await assertSucceeds(uploadBytes(ref(alice, path), new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' }));
  await assertSucceeds(getBytes(ref(bob, path)));
  await assertFails(getBytes(ref(mallory, path)));
  await assertFails(uploadBytes(ref(alice, path), new Uint8Array([4]), { contentType: 'image/jpeg' }));
});

test('invitations expirables : renouvellement, utilisation unique et concurrence', async () => {
  const { coupleId } = await createSpace('alice', profile);
  await assert.rejects(createSpace('alice', profile), { code: 'already-exists' });
  const first = await issueInvitation('alice', coupleId);
  assert.equal(first.code.length, 10);
  assert.ok(first.expiresAt > Date.now() + 23 * 3600000);
  const next = await issueInvitation('alice', coupleId);
  await assert.rejects(acceptInvitation('bob', { code: first.code, profile }), { code: 'failed-precondition' });
  await db.doc(`invitations/${hash(next.code)}`).update({ expiresAt: Date.now() - 1 });
  await assert.rejects(acceptInvitation('bob', { code: next.code, profile }), { code: 'failed-precondition' });
  const valid = await issueInvitation('alice', coupleId);
  const results = await Promise.allSettled(['bob', 'eve'].map(uid => acceptInvitation(uid, { code: valid.code, profile })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await db.doc(`couples/${coupleId}`).get()).data().members.length, 2);
  await assert.rejects(issueInvitation('alice', coupleId), { code: 'failed-precondition' });
  await assert.rejects(acceptInvitation('other', { code: valid.code, profile }), { code: 'failed-precondition' });
});

test('un membre retrouve son rattachement après consommation du code sans réutiliser l’invitation', async () => {
  const { coupleId } = await createSpace('alice', profile);
  const invitation = await issueInvitation('alice', coupleId);
  await acceptInvitation('bob', { code: invitation.code, profile });
  await assert.rejects(acceptInvitation('bob', { code: invitation.code, profile }), { code: 'failed-precondition' });
  const bob = client('bob');
  const index = await assertSucceeds(getDoc(doc(bob, 'users', 'bob')));
  assert.equal(index.data().coupleId, coupleId);
  const couple = await assertSucceeds(getDoc(doc(bob, 'couples', index.data().coupleId)));
  assert.deepEqual(couple.data().members, ['alice', 'bob']);
  await assertFails(getDoc(doc(client('mallory'), 'users', 'bob')));
  await assertFails(getDoc(doc(client('mallory'), 'couples', coupleId)));
});

test('le quota atomique résiste aux appels simultanés et se réinitialise', async () => {
  const limits = [{ key: 'cost', maximum: 3, windowMs: 1000 }];
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => consumeQuota(limits, 1000)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
  await assert.rejects(consumeQuota(limits, 1500), { code: 'resource-exhausted' });
  await consumeQuota(limits, 2001);
});

test('la purge retire les traces expirées, conserve les comptes et ne supprime jamais une tâche en attente', async () => {
  await seed();
  const now = Date.now();
  const docs = {
    'rateLimits/old': { count: 4, resetAt: now - RETENTION.expiredQuotaMs - 1 },
    'rateLimits/recent': { count: 4, resetAt: now - 1000 },
    'rateLimits/active': { count: 1, resetAt: now + 100000 },
    'accountDeletions/finished': { status: 'complete', completedAt: now - RETENTION.completedDeletionMs - 1, leaseUntil: 0 },
    'accountDeletions/recent': { status: 'complete', completedAt: now - 1000, leaseUntil: 0 },
    'accountDeletions/pending': { status: 'pending', completedAt: now - RETENTION.completedDeletionMs - 1, leaseUntil: 0 },
    'accountDeletions/leased': { status: 'complete', completedAt: now - RETENTION.completedDeletionMs - 1, leaseUntil: now + 10000 },
    'invitations/old': { coupleId: cid, expiresAt: now - 1 },
    'invitations/new': { coupleId: cid, expiresAt: now + 100000 },
    [`coupleInvitations/${cid}`]: { digest: 'new' },
  };
  await Promise.all(Object.entries(docs).map(([path, data]) => db.doc(path).set(data)));
  assert.deepEqual(await purgeTechnicalData(now, 1), { invitations: 1, rateLimits: 1, completedDeletions: 1 });
  for (const path of ['rateLimits/old', 'accountDeletions/finished', 'invitations/old']) assert.equal((await db.doc(path).get()).exists, false);
  for (const path of ['rateLimits/recent', 'rateLimits/active', 'accountDeletions/pending', 'accountDeletions/leased', 'accountDeletions/recent', 'invitations/new', `coupleInvitations/${cid}`, `couples/${cid}`, 'users/alice', 'users/bob']) {
    assert.equal((await db.doc(path).get()).exists, true, path);
  }
  assert.equal((await db.doc(`coupleInvitations/${cid}`).get()).data().digest, 'new');
  assert.deepEqual(await purgeTechnicalData(now), { invitations: 0, rateLimits: 0, completedDeletions: 0 });
});

test('la purge retire le pointeur d’une invitation expirée sans toucher à l’espace', async () => {
  await seed(['alice']);
  const invitation = await issueInvitation('alice', cid);
  const now = invitation.expiresAt + 1;
  await purgeTechnicalData(now);
  assert.equal((await db.doc(`coupleInvitations/${cid}`).get()).exists, false);
  assert.equal((await db.doc(`invitations/${hash(invitation.code)}`).get()).exists, false);
  assert.equal((await db.doc(`couples/${cid}`).get()).exists, true);
  await issueInvitation('alice', cid);
});

test('une réponse reste secrète côté serveur jusqu’à la seconde réponse', async () => {
  await seed();
  await submitAnswer('alice', { coupleId: cid, date, text: 'Secret Alice' });
  assert.equal((await getDoc(doc(client('alice'), `couples/${cid}/private/alice/answers/${date}`))).data().text, 'Secret Alice');
  await assertFails(getDoc(doc(client('bob'), `couples/${cid}/private/alice/answers/${date}`)));
  assert.equal((await getDocs(collection(client('bob'), `couples/${cid}/revealedAnswers`))).size, 0);
  assert.deepEqual((await db.doc(`couples/${cid}/answerStatus/${date}`).get()).data().responded, ['alice']);
  await assert.rejects(submitAnswer('alice', { coupleId: cid, date, text: 'Doublon' }), { code: 'already-exists' });
  await assert.rejects(submitAnswer('mallory', { coupleId: cid, date, text: 'Intrus' }), { code: 'permission-denied' });
  await submitAnswer('bob', { coupleId: cid, date, text: 'Secret Bob' });
  assert.equal((await getDocs(collection(client('alice'), `couples/${cid}/revealedAnswers`))).size, 2);
  await assertFails(setDoc(doc(client('alice'), `couples/${cid}/revealedAnswers/fake`), { text: 'fake' }));
});

test('les réponses simultanées sont révélées une seule fois, sans perte', async () => {
  await seed();
  await Promise.all(['alice', 'bob'].map(uid => submitAnswer(uid, { coupleId: cid, date, text: uid })));
  assert.equal((await db.collection(`couples/${cid}/revealedAnswers`).get()).size, 2);
});

test('le consentement IA doit être explicite, personnel et révocable', async () => {
  await seed();
  await assert.rejects(requireAiConsent('alice'), { code: 'failed-precondition' });
  await security.setAiConsent.run(call('alice', { coupleId: cid, accepted: true }));
  await requireAiConsent('alice');
  assert.equal((await db.doc('users/alice/settings/privacy').get()).data().aiConsent, AI_CONSENT_VERSION);
  await assert.rejects(requireAiConsent('bob'), { code: 'failed-precondition' });
  await assertFails(setDoc(doc(client('alice'), 'users/alice/settings/privacy'), { aiConsent: AI_CONSENT_VERSION }));
  await security.setAiConsent.run(call('alice', { coupleId: cid, accepted: false }));
  await assert.rejects(requireAiConsent('alice'), { code: 'failed-precondition' });
});

test('suppression : réauthentification exigée avant toute modification', async () => {
  await seed();
  await assert.rejects(security.deleteAccount.run(call('alice', { coupleId: cid }, 600)), { code: 'failed-precondition' });
  assert.equal((await db.doc('accountDeletions/alice').get()).exists, false);
  assert.deepEqual((await db.doc(`couples/${cid}`).get()).data().members, ['alice', 'bob']);
});

test('la suppression refuse une identité confirmée différente avant de créer une tâche', async () => {
  await seed();
  for (const expectedUserId of ['alice', '', null, 42]) {
    await assert.rejects(security.deleteAccount.run(call('bob', { coupleId: cid, expectedUserId })), { code: 'failed-precondition' });
    assert.equal((await db.doc('accountDeletions/bob').get()).exists, false);
    assert.deepEqual((await db.doc(`couples/${cid}`).get()).data().members, ['alice', 'bob']);
  }
});

test('la suppression accepte une identité correspondante et reste compatible avec les anciens clients', async () => {
  for (const expected of [true, false]) {
    await seed();
    await db.doc('accountDeletions/alice').delete();
    const result = await security.deleteAccount.run(call('alice', { coupleId: cid, ...(expected ? { expectedUserId: 'alice' } : {}) }));
    assert.equal(result.status, 'complete');
    assert.deepEqual((await db.doc(`couples/${cid}`).get()).data().members, ['bob']);
  }
});

test('suppression reprise après panne : photos, privé, Auth et index nettoyés ; partenaire conservé', async () => {
  await seed();
  await getAuth().createUser({ uid: 'delete-alice' });
  await db.doc(`couples/${cid}`).update({ members: ['delete-alice', 'bob'], profiles: { 'delete-alice': profile, bob: profile } });
  await db.doc('users/delete-alice').set({ coupleId: cid });
  await db.doc(`couples/${cid}/private/delete-alice/gifts/one`).set({ title: 'secret' });
  await db.doc(`couples/${cid}/private/delete-alice/settlementRequests/one`).set({ fingerprint: 'fictitious', settlementId: 'one' });
  await db.doc(`couples/${cid}/private/bob/settlementRequests/one`).set({ fingerprint: 'fictitious', settlementId: 'other' });
  const deletedMemory = await memoryApi().associateMemory.run(call('delete-alice', memoryInput({ expectedUserId: 'delete-alice' })));
  const keptMemory = await memoryApi().associateMemory.run(call('bob', memoryInput({ expectedUserId: 'bob' })));
  await db.doc(`couples/${cid}/notes/one`).set({ from: 'delete-alice', text: 'secret' });
  await db.doc(`couples/${cid}/expenses/one`).set({ paidBy: 'delete-alice', amount: 10 });
  await db.doc(`couples/${cid}/private/bob/gifts/one`).set({ title: 'conserver' });
  const bucket = getStorage().bucket();
  const mine = bucket.file(`couples/${cid}/photos/delete-alice/one.jpg`);
  const other = bucket.file(`couples/${cid}/photos/bob/one.jpg`);
  await mine.save(Buffer.from('image'), { contentType: 'image/jpeg' });
  await other.save(Buffer.from('image'), { contentType: 'image/jpeg' });
  await queueDeletion('delete-alice', cid);
  await assertFails(getDoc(doc(client('delete-alice'), 'couples', cid)));
  // Le partenaire peut encore restaurer sa session pendant le nettoyage,
  // notamment s'il utilise encore un compte anonyme.
  await assertSucceeds(getDoc(doc(client('bob'), 'couples', cid)));
  await assertFails(updateDoc(doc(client('bob'), 'couples', cid), { since: date }));
  await assert.rejects(security.activeUid(call('delete-alice', {})), { code: 'failed-precondition' });
  const storage = getStorage();
  const originalBucket = storage.bucket;
  storage.bucket = () => bucket;
  const original = bucket.getFiles;
  bucket.getFiles = async () => { throw Object.assign(new Error('Storage indisponible'), { code: 503 }); };
  try { await assert.rejects(completeDeletion('delete-alice')); }
  finally { bucket.getFiles = original; storage.bucket = originalBucket; }
  assert.equal((await db.doc('accountDeletions/delete-alice').get()).data().status, 'pending');
  assert.ok(await getAuth().getUser('delete-alice'));
  await completeDeletion('delete-alice');
  await completeDeletion('delete-alice'); // idempotence
  assert.equal((await mine.exists())[0], false);
  assert.equal((await other.exists())[0], true);
  assert.equal((await db.doc(`couples/${cid}/private/delete-alice/gifts/one`).get()).exists, false);
  assert.equal((await db.doc(`couples/${cid}/private/delete-alice/settlementRequests/one`).get()).exists, false);
  assert.equal((await db.doc(`couples/${cid}/private/bob/settlementRequests/one`).get()).exists, true);
  assert.equal((await db.doc(`couples/${cid}/private/delete-alice/memoryRequests/memory-alice-0001`).get()).exists, false);
  assert.equal((await db.doc(`couples/${cid}/private/bob/memoryRequests/memory-alice-0001`).get()).exists, true);
  assert.equal((await db.doc(`couples/${cid}/memories/${deletedMemory.memoryId}`).get()).exists, false);
  assert.equal((await db.doc(`couples/${cid}/memories/${keptMemory.memoryId}`).get()).exists, true);
  assert.equal((await db.doc(`couples/${cid}/notes/one`).get()).exists, false);
  assert.equal((await db.doc(`couples/${cid}/private/bob/gifts/one`).get()).exists, true);
  assert.equal((await db.doc(`couples/${cid}/expenses/one`).get()).data().paidBy, 'former-member');
  assert.equal((await db.doc('users/delete-alice').get()).exists, false);
  assert.deepEqual((await db.doc(`couples/${cid}`).get()).data().members, ['bob']);
  await assertSucceeds(getDoc(doc(client('bob'), 'couples', cid)));
  await assert.rejects(getAuth().getUser('delete-alice'), { code: 'auth/user-not-found' });
});

test('la suppression du dernier membre efface aussi les sous-collections et fichiers orphelins', async () => {
  await seed(['last-member']);
  await db.doc(`couples/${cid}/items/one`).set({ title: 'partagé' });
  const receiptPaths = ['last-member', 'unknown-old'].flatMap(uid => ['settlementRequests', 'memoryRequests'].map(col => `couples/${cid}/private/${uid}/${col}/one`));
  for (const path of receiptPaths) await db.doc(path).set({ fingerprint: 'fictitious', settlementId: 'old-mark', createdAt: new Date() });
  const file = getStorage().bucket().file(`couples/${cid}/photos/unknown-old.jpg`);
  await file.save(Buffer.from('image'), { contentType: 'image/jpeg' });
  await queueDeletion('last-member', cid);
  await completeDeletion('last-member');
  assert.equal((await db.doc(`couples/${cid}`).get()).exists, false);
  assert.equal((await db.doc(`couples/${cid}/items/one`).get()).exists, false);
  for (const path of receiptPaths) assert.equal((await db.doc(path).get()).exists, false);
  assert.equal((await file.exists())[0], false);
  assert.equal((await db.doc('accountDeletions/last-member').get()).data().status, 'complete');
});

test('migration : simulation sans écriture, confidentialité, jetons privés et réexécution sans perte', async () => {
  await seed();
  await db.doc(`couples/${cid}`).update({ 'profiles.alice.pushToken': 'ExponentPushToken[test-token]' });
  await db.doc(`couples/${cid}/answers/old`).set({ from: 'alice', date, text: 'ancienne réponse', createdAt: 1 });
  const summary = await migrateSecurity(false);
  assert.equal(summary.legacyAnswers, 1);
  assert.equal((await db.doc(`couples/${cid}/private/alice/answers/${date}`).get()).exists, false);
  await migrateSecurity(true);
  assert.equal((await db.doc(`couples/${cid}`).get()).data().profiles.alice.pushToken, undefined);
  assert.equal((await db.collection('users/alice/devices').get()).size, 1);
  assert.equal((await db.collection(`couples/${cid}/revealedAnswers`).get()).size, 0);
  await submitAnswer('bob', { coupleId: cid, date, text: 'nouvelle réponse' });
  await migrateSecurity(true);
  assert.equal((await db.doc(`couples/${cid}/private/bob/answers/${date}`).get()).data().text, 'nouvelle réponse');
  assert.equal((await db.collection(`couples/${cid}/revealedAnswers`).get()).size, 2);
});
