import * as native from 'react-native';

const mockSdk = {
  isConfigured: jest.fn(), configure: jest.fn(), getAppUserID: jest.fn(), logIn: jest.fn(),
  getOfferings: jest.fn(), purchasePackage: jest.fn(), restorePurchases: jest.fn(),
};
let mockPlatform = 'ios';
let mockOwnership = 'standalone';
jest.mock('react-native-purchases', () => ({ __esModule: true, default: mockSdk }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { get appOwnership() { return mockOwnership; } } }));

async function load(enabled = true) {
  jest.doMock('react-native', () => Object.create(native, { Platform: { value: { OS: mockPlatform } } }));
  process.env.EXPO_PUBLIC_BILLING_ENABLED = String(enabled);
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test_public_key';
  let billing!: typeof import('../billing');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    billing = require('../billing');
  });
  return billing;
}

beforeEach(() => {
  jest.clearAllMocks(); mockPlatform = 'ios'; mockOwnership = 'standalone';
  mockSdk.isConfigured.mockResolvedValue(false);
  mockSdk.getAppUserID.mockResolvedValue('firebase-user');
  mockSdk.logIn.mockResolvedValue({});
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_BILLING_ENABLED;
  delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
});

test.each(['web', 'expo', 'disabled'])('%s never initializes or simulates the store', async (mode) => {
  if (mode === 'web') mockPlatform = 'web';
  if (mode === 'expo') mockOwnership = 'expo';
  const billing = await load(mode !== 'disabled');
  expect(billing.nativeBillingAvailable).toBe(false);
  await expect(billing.loadSubscriptionPackages('firebase-user')).rejects.toThrow();
  expect(mockSdk.configure).not.toHaveBeenCalled();
});

test('offerings use localized store products and reject other billing periods', async () => {
  const monthly = { identifier: 'monthly', product: { subscriptionPeriod: 'P1M', priceString: '4,99 €' } };
  const lifetime = { identifier: 'lifetime', product: { subscriptionPeriod: null, priceString: '99,99 €' } };
  mockSdk.getOfferings.mockResolvedValue({ current: { availablePackages: [monthly, lifetime] } });
  const billing = await load();
  expect(await billing.loadSubscriptionPackages('firebase-user')).toEqual([monthly]);
  expect(mockSdk.configure).toHaveBeenCalledWith({ apiKey: 'appl_test_public_key', appUserID: 'firebase-user' });
});

test('a new Firebase identity is logged in before restoration', async () => {
  mockSdk.isConfigured.mockResolvedValue(true);
  mockSdk.getAppUserID.mockResolvedValue('old-account');
  mockSdk.logIn.mockImplementation(async () => { expect(mockSdk.restorePurchases).not.toHaveBeenCalled(); });
  const billing = await load();
  await billing.restoreSubscriptions('current-account');
  expect(mockSdk.logIn).toHaveBeenCalledWith('current-account');
  expect(mockSdk.restorePurchases).toHaveBeenCalledTimes(1);
});

test('cancelling the store sheet is quiet and never implies Plus access', async () => {
  mockSdk.purchasePackage.mockRejectedValue({ userCancelled: true });
  const billing = await load();
  const offer = { identifier: 'annual' } as Parameters<typeof billing.buySubscription>[1];
  expect(await billing.buySubscription('firebase-user', offer)).toBe(false);
  mockSdk.purchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: { nous_deux_plus: {} } } } });
  expect(await billing.buySubscription('firebase-user', offer)).toBe(true);
  expect(billing.FREE_SUBSCRIPTION.active).toBe(false);
});
