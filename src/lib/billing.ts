import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

export type SubscriptionStatus = {
  active: boolean;
  expiresAt: number | null;
  owner: 'self' | 'partner' | null;
};

export const FREE_SUBSCRIPTION: SubscriptionStatus = { active: false, expiresAt: null, owner: null };
export const billingEnabled = process.env.EXPO_PUBLIC_BILLING_ENABLED === 'true';
export const billingLegal = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_URL ?? '',
  terms: process.env.EXPO_PUBLIC_TERMS_URL ?? '',
};
export const validLegalUrl = (url: string) => /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(url);

const apiKey = Platform.OS === 'ios'
  ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
  : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const nativeBillingAvailable = billingEnabled && (Platform.OS === 'ios' || Platform.OS === 'android')
  && Constants.appOwnership !== 'expo' && Boolean(apiKey);

// Native code is loaded only after the platform/configuration guard. Expo Go and
// web never initialize a mocked store or grant a simulated subscription.
let queue: Promise<unknown> = Promise.resolve();
function storeAction<T>(uid: string, action: (sdk: typeof import('react-native-purchases').default) => Promise<T>): Promise<T> {
  const next = queue.catch(() => {}).then(async () => {
    if (!nativeBillingAvailable || !apiKey) throw new Error('Les achats sont disponibles dans l’application installée, après activation du service.');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = (require('react-native-purchases') as typeof import('react-native-purchases')).default;
    if (!(await sdk.isConfigured())) sdk.configure({ apiKey, appUserID: uid });
    else if ((await sdk.getAppUserID()) !== uid) await sdk.logIn(uid);
    return action(sdk);
  });
  queue = next;
  return next;
}

export function loadSubscriptionPackages(uid: string): Promise<PurchasesPackage[]> {
  return storeAction(uid, async (sdk) => {
    const offerings = await sdk.getOfferings();
    // Only the documented monthly/yearly subscriptions are shown. A lifetime
    // or unrelated remote product must not inherit the subscription wording.
    return (offerings.current?.availablePackages ?? []).filter((p) =>
      p.product.subscriptionPeriod === 'P1M' || p.product.subscriptionPeriod === 'P1Y');
  });
}

export async function buySubscription(uid: string, selected: PurchasesPackage): Promise<boolean> {
  try {
    await storeAction(uid, (sdk) => sdk.purchasePackage(selected));
    // SDK success never grants access; getSubscription verifies on the server.
    return true;
  } catch (error) {
    if ((error as { userCancelled?: boolean })?.userCancelled) return false;
    throw new Error('L’achat n’a pas pu être confirmé. Vérifie ta connexion ou restaure tes achats avant de réessayer.');
  }
}

export async function restoreSubscriptions(uid: string) {
  await storeAction(uid, (sdk) => sdk.restorePurchases());
}

export async function manageSubscriptions() {
  await Linking.openURL(Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions');
}
