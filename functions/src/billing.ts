import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { activeUid, consumeQuota, memberCouple } from './security';

export const REVENUECAT_SECRET_KEY = defineSecret('REVENUECAT_SECRET_KEY');
export const PLUS_ENTITLEMENT = 'nous_deux_plus';

/** Review/TestFlight accounts may use verified StoreKit sandbox purchases in
 * production without granting sandbox access to the general public. Both
 * settings are private server configuration, never EXPO_PUBLIC variables. */
export function sandboxAllowedForUid(uid: string, allSandbox: unknown, allowlist: unknown): boolean {
  if (!uid.trim()) return false;
  if (allSandbox === 'true') return true;
  if (typeof allowlist !== 'string') return false;
  return allowlist.split(',').map((entry) => entry.trim()).filter(Boolean).includes(uid);
}

export type SubscriptionStatus = {
  active: boolean;
  expiresAt: number | null;
  owner: 'self' | 'partner' | null;
};

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function date(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function expiration(record: RecordValue): number | null {
  const regular = date(record.expires_date);
  const grace = date(record.grace_period_expires_date);
  // A malformed expiry must never become a permanent entitlement.
  if (regular === null) return null;
  return grace === null ? regular : Math.max(regular, grace);
}

/** Parse only provider data fetched by the server, never data submitted by the app. */
export function parsePlusEntitlement(payload: unknown, now = Date.now(), allowSandbox = false): { active: boolean; expiresAt: number | null } {
  const inactive = { active: false, expiresAt: null };
  const subscriber = object(object(payload)?.subscriber);
  const entitlement = object(object(subscriber?.entitlements)?.[PLUS_ENTITLEMENT]);
  if (!subscriber || !entitlement || typeof entitlement.product_identifier !== 'string') return inactive;
  if (date(entitlement.purchase_date) === null) return inactive;
  const product = entitlement.product_identifier;
  const subscription = object(object(subscriber.subscriptions)?.[product]);

  if (subscription) {
    if (subscription.is_sandbox !== false && !(allowSandbox && subscription.is_sandbox === true)) return inactive;
    if (subscription.refunded_at !== null && subscription.refunded_at !== undefined) return inactive;
    const providerExpiry = expiration(subscription);
    const entitlementExpiry = expiration(entitlement);
    if (providerExpiry === null || entitlementExpiry === null) return inactive;
    const expiresAt = Math.min(providerExpiry, entitlementExpiry);
    return expiresAt > now ? { active: true, expiresAt } : inactive;
  }

  // RevenueCat represents a lifetime purchase with a null entitlement expiration
  // and a corresponding non-subscription transaction. Undefined is not lifetime.
  if (entitlement.expires_date !== null) return inactive;
  const transactions = object(subscriber.non_subscriptions)?.[product];
  if (!Array.isArray(transactions)) return inactive;
  const permanent = transactions.some((raw) => {
    const transaction = object(raw);
    return transaction && date(transaction.purchase_date) !== null &&
      (transaction.is_sandbox === false || (allowSandbox && transaction.is_sandbox === true)) &&
      (transaction.refunded_at === null || transaction.refunded_at === undefined);
  });
  return permanent ? { active: true, expiresAt: null } : inactive;
}

async function subscriberStatus(uid: string) {
  const key = REVENUECAT_SECRET_KEY.value();
  if (!key) throw new HttpsError('failed-precondition', 'Les abonnements ne sont pas encore disponibles.');
  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return { active: false, expiresAt: null };
    if (!response.ok) throw new Error('Subscription provider unavailable');
    return parsePlusEntitlement(await response.json(), Date.now(), sandboxAllowedForUid(uid, process.env.BILLING_ALLOW_SANDBOX, process.env.BILLING_SANDBOX_UIDS));
  } catch {
    // Fail closed. Do not store receipts, provider payloads or API keys in logs.
    throw new HttpsError('unavailable', 'La vérification de l’abonnement n’a pas abouti. Réessaie dans un instant.');
  }
}

/** One verified subscription covers the two current members of this space. */
export async function verifyCoupleSubscription(uid: string, rawCoupleId: unknown): Promise<SubscriptionStatus> {
  const { data, coupleId } = await memberCouple(uid, rawCoupleId);
  const members = data.members as string[];
  if (!Array.isArray(members) || members.length < 1 || members.length > 2) {
    throw new HttpsError('failed-precondition', 'Cet espace ne permet pas de vérifier l’abonnement.');
  }
  const results = await Promise.all(members.map(async (member) => ({ uid: member, ...await subscriberStatus(member) })));
  // Membership may change while the provider is responding. Never retain access
  // from somebody who has left, and respect a deletion lock created in between.
  const latest = await memberCouple(uid, coupleId);
  const active = results.filter((status) => status.active && latest.data.members.includes(status.uid));
  const owned = active.find((status) => status.uid === uid) ?? active[0];
  if (!owned) return { active: false, expiresAt: null, owner: null };
  return { active: true, expiresAt: owned.expiresAt, owner: owned.uid === uid ? 'self' : 'partner' };
}

/** Premium server actions must call this and bind REVENUECAT_SECRET_KEY. */
export async function requireCouplePlus(uid: string, coupleId: unknown): Promise<SubscriptionStatus> {
  const status = await verifyCoupleSubscription(uid, coupleId);
  if (!status.active) throw new HttpsError('permission-denied', 'Cette fonctionnalité est réservée à Nous Deux Plus.');
  return status;
}

export const getSubscription = onCall(
  { region: 'europe-west1', secrets: [REVENUECAT_SECRET_KEY], maxInstances: 3, timeoutSeconds: 30 },
  async (request) => {
    const uid = await activeUid(request);
    // Check membership before consuming provider calls or per-user quota.
    await memberCouple(uid, request.data?.coupleId);
    await consumeQuota([{ key: `billing:${uid}`, maximum: 120, windowMs: 3_600_000 }]);
    return verifyCoupleSubscription(uid, request.data?.coupleId);
  },
);
