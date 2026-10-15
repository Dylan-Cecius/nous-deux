const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, Timestamp, writeBatch } = require('firebase/firestore');
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
