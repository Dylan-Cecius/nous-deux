const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePlusEntitlement, sandboxAllowedForUid } = require('../lib/billing');

const now = Date.parse('2026-11-12T12:00:00Z');
const future = '2026-12-12T12:00:00Z';
const past = '2026-10-12T12:00:00Z';
const purchase = '2026-09-12T12:00:00Z';
function payload({ entitlement = {}, subscription = {}, subscriber = {} } = {}) {
  return {
    subscriber: {
      entitlements: { nous_deux_plus: { product_identifier: 'plus_monthly', expires_date: future, purchase_date: purchase, ...entitlement } },
      subscriptions: { plus_monthly: { expires_date: future, is_sandbox: false, refunded_at: null, ...subscription } },
      ...subscriber,
    },
  };
}

test('only a matching active provider subscription grants Plus', () => {
  assert.deepEqual(parsePlusEntitlement(payload(), now), { active: true, expiresAt: Date.parse(future) });
  for (const data of [null, {}, { subscriber: {} }, payload({ subscriber: { subscriptions: {} } }), payload({ entitlement: { product_identifier: 'other' } })]) {
    assert.equal(parsePlusEntitlement(data, now).active, false);
  }
});

test('expiration and refund revoke access, cancellation does not revoke paid remaining time', () => {
  assert.equal(parsePlusEntitlement(payload({ entitlement: { expires_date: past } }), now).active, false);
  assert.equal(parsePlusEntitlement(payload({ subscription: { expires_date: past } }), now).active, false);
  assert.equal(parsePlusEntitlement(payload({ subscription: { refunded_at: purchase } }), now).active, false);
  assert.equal(parsePlusEntitlement(payload({ subscription: { unsubscribe_detected_at: purchase } }), now).active, true);
  assert.equal(parsePlusEntitlement(payload(), Date.parse(future)).active, false);
});

test('billing grace period extends only when both provider and entitlement confirm it', () => {
  const data = payload({ entitlement: { expires_date: past, grace_period_expires_date: future }, subscription: { expires_date: past, grace_period_expires_date: future } });
  assert.equal(parsePlusEntitlement(data, now).active, true);
  assert.equal(parsePlusEntitlement(payload({ entitlement: { expires_date: past }, subscription: { expires_date: past, grace_period_expires_date: future } }), now).active, false);
});

test('sandbox purchases are rejected unless the server explicitly enables test access', () => {
  const data = payload({ subscription: { is_sandbox: true } });
  assert.equal(parsePlusEntitlement(data, now).active, false);
  assert.equal(parsePlusEntitlement(data, now, true).active, true);
  assert.equal(parsePlusEntitlement(payload({ subscription: { is_sandbox: undefined } }), now, true).active, false);
});

test('sandbox review allowlist uses exact nonempty Firebase UIDs', () => {
  assert.equal(sandboxAllowedForUid('review-buyer', undefined, 'other, review-buyer ,last'), true);
  assert.equal(sandboxAllowedForUid('review', undefined, 'review-buyer'), false);
  assert.equal(sandboxAllowedForUid('review-buyer-extra', undefined, 'review-buyer'), false);
  assert.equal(sandboxAllowedForUid('review-buyer', 'false', ''), false);
  assert.equal(sandboxAllowedForUid('review-buyer', undefined, undefined), false);
  assert.equal(sandboxAllowedForUid('', undefined, ', ,'), false);
  assert.equal(sandboxAllowedForUid(' ', 'true', ''), false);
  assert.equal(sandboxAllowedForUid('staging-buyer', 'true', ''), true);
  assert.equal(sandboxAllowedForUid('public-buyer', true, ''), false);
});

test('malformed dates and incomplete entitlement records fail closed', () => {
  for (const expires_date of [undefined, null, '', 'invalid', 123]) {
    assert.equal(parsePlusEntitlement(payload({ entitlement: { expires_date } }), now).active, false);
    assert.equal(parsePlusEntitlement(payload({ subscription: { expires_date } }), now).active, false);
  }
  assert.equal(parsePlusEntitlement(payload({ entitlement: { purchase_date: undefined } }), now).active, false);
});

test('lifetime rights require a matching verified non-subscription transaction', () => {
  const lifetime = payload({ entitlement: { expires_date: null }, subscriber: { subscriptions: {}, non_subscriptions: { plus_monthly: [{ purchase_date: purchase, is_sandbox: false }] } } });
  assert.deepEqual(parsePlusEntitlement(lifetime, now), { active: true, expiresAt: null });
  lifetime.subscriber.non_subscriptions.plus_monthly[0].is_sandbox = true;
  assert.equal(parsePlusEntitlement(lifetime, now).active, false);
  assert.equal(parsePlusEntitlement(lifetime, now, true).active, true);
  lifetime.subscriber.non_subscriptions.plus_monthly[0].refunded_at = purchase;
  assert.equal(parsePlusEntitlement(lifetime, now, true).active, false);
});
