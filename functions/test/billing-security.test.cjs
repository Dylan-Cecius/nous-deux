const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Provider calls below are fully mocked; all membership reads must stay local.
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Ces tests exigent Firestore Emulator, sans accès cloud.');
const app = initializeApp({ projectId: 'demo-nous-deux-security' });
const db = getFirestore();
const { verifyCoupleSubscription } = require('../lib/billing');
const cid = 'billing-review-space';
const members = ['billing-alice', 'billing-bob'];
const originalFetch = global.fetch;
const originalKey = process.env.REVENUECAT_SECRET_KEY;
const originalSandbox = process.env.BILLING_ALLOW_SANDBOX;

function provider(active) {
  return { subscriber: active ? {
    entitlements: { nous_deux_plus: { product_identifier: 'plus_monthly', purchase_date: new Date(Date.now() - 86_400_000).toISOString(), expires_date: new Date(Date.now() + 86_400_000).toISOString() } },
    subscriptions: { plus_monthly: { is_sandbox: false, expires_date: new Date(Date.now() + 86_400_000).toISOString(), refunded_at: null } },
  } : { entitlements: {}, subscriptions: {} } };
}
const response = (body) => ({ ok: true, status: 200, json: async () => body });

beforeEach(async () => {
  process.env.REVENUECAT_SECRET_KEY = 'mock-server-key';
  delete process.env.BILLING_ALLOW_SANDBOX;
  await db.doc(`couples/${cid}`).set({ members });
});
after(async () => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.REVENUECAT_SECRET_KEY; else process.env.REVENUECAT_SECRET_KEY = originalKey;
  if (originalSandbox === undefined) delete process.env.BILLING_ALLOW_SANDBOX; else process.env.BILLING_ALLOW_SANDBOX = originalSandbox;
  await db.doc(`couples/${cid}`).delete();
  await deleteApp(app);
});

test('un tiers ne peut vérifier un couple ni déclencher de requête au fournisseur', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('Unexpected provider call'); };
  await assert.rejects(verifyCoupleSubscription('billing-outsider', cid), { code: 'permission-denied' });
  assert.equal(calls, 0);
});

test('un droit payé par la moitié profite au membre actuel, sans exposer le reçu', async () => {
  const seen = [];
  global.fetch = async (url) => {
    seen.push(url);
    return response(provider(url.endsWith('/billing-bob')));
  };
  const status = await verifyCoupleSubscription('billing-alice', cid);
  assert.equal(status.active, true);
  assert.equal(status.owner, 'partner');
  assert.equal(typeof status.expiresAt, 'number');
  assert.deepEqual(Object.keys(status).sort(), ['active', 'expiresAt', 'owner']);
  assert.equal(seen.length, 2);
});

test('le départ du payeur pendant la vérification retire le droit partagé', async () => {
  global.fetch = async (url) => {
    if (url.endsWith('/billing-bob')) {
      await db.doc(`couples/${cid}`).update({ members: ['billing-alice'] });
      return response(provider(true));
    }
    return response(provider(false));
  };
  assert.deepEqual(await verifyCoupleSubscription('billing-alice', cid), { active: false, expiresAt: null, owner: null });
});

test('une panne fournisseur ne devient jamais un accès Plus', async () => {
  global.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(verifyCoupleSubscription('billing-alice', cid), { code: 'unavailable' });
});

test('une suppression débutée pendant la requête bloque aussi le droit payé', async () => {
  global.fetch = async () => {
    await db.doc(`couples/${cid}`).update({ deletionLock: 'billing-bob' });
    return response(provider(true));
  };
  await assert.rejects(verifyCoupleSubscription('billing-alice', cid), { code: 'failed-precondition' });
});
