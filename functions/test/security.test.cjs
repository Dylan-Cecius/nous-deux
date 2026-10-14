const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } = require('firebase/firestore');
const { ref, uploadBytes, getBytes } = require('firebase/storage');

const projectId = 'demo-nous-deux-security';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('Ces tests exigent les trois émulateurs. Aucun accès au cloud réel.');
}
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const db = getFirestore();
const security = require('../lib/security');
const { migrateSecurity } = require('../lib/migration');
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

test('le quota atomique résiste aux appels simultanés et se réinitialise', async () => {
  const limits = [{ key: 'cost', maximum: 3, windowMs: 1000 }];
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => consumeQuota(limits, 1000)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
  await assert.rejects(consumeQuota(limits, 1500), { code: 'resource-exhausted' });
  await consumeQuota(limits, 2001);
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

test('suppression reprise après panne : photos, privé, Auth et index nettoyés ; partenaire conservé', async () => {
  await seed();
  await getAuth().createUser({ uid: 'delete-alice' });
  await db.doc(`couples/${cid}`).update({ members: ['delete-alice', 'bob'], profiles: { 'delete-alice': profile, bob: profile } });
  await db.doc('users/delete-alice').set({ coupleId: cid });
  await db.doc(`couples/${cid}/private/delete-alice/gifts/one`).set({ title: 'secret' });
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
  const file = getStorage().bucket().file(`couples/${cid}/photos/unknown-old.jpg`);
  await file.save(Buffer.from('image'), { contentType: 'image/jpeg' });
  await queueDeletion('last-member', cid);
  await completeDeletion('last-member');
  assert.equal((await db.doc(`couples/${cid}`).get()).exists, false);
  assert.equal((await db.doc(`couples/${cid}/items/one`).get()).exists, false);
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
