const { test, expect } = require('@jest/globals');
const { publicHttps, billingProblems, storeProblems } = require('../store-config.cjs');

test('une page légale locale, provisoire ou avec identifiants ne valide pas une distribution', () => {
  for (const url of ['http://legal.my-app.fr', 'https://localhost/policy', 'https://127.0.0.1', 'https://[::1]', 'https://demo.example.com/privacy', 'https://legal.invalid', 'https://user:password@my-app.fr']) {
    expect(publicHttps(url)).toBe(false);
  }
  expect(publicHttps('https://my-app.fr/confidentialite')).toBe(true);
});

test('une diffusion publique exige l’identité et le contact, même sans abonnement', () => {
  expect(storeProblems({})).toHaveLength(4);
  expect(storeProblems({
    EXPO_PUBLIC_PRIVACY_URL: 'https://my-app.fr/privacy', EXPO_PUBLIC_TERMS_URL: 'https://my-app.fr/terms',
    EXPO_PUBLIC_LEGAL_ENTITY: 'Éditeur de test', EXPO_PUBLIC_SUPPORT_EMAIL: 'support@my-app.fr',
  })).toEqual([]);
});

test('une version iOS facturée requiert sa clé native et ses documents légaux', () => {
  const env = { EAS_BUILD_PLATFORM: 'ios', EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'test_not-a-store', EXPO_PUBLIC_PRIVACY_URL: '', EXPO_PUBLIC_TERMS_URL: '' };
  expect(billingProblems(env)).toHaveLength(3);
  expect(billingProblems({ ...env, EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_publicSdkKey', EXPO_PUBLIC_PRIVACY_URL: 'https://my-app.fr/privacy', EXPO_PUBLIC_TERMS_URL: 'https://my-app.fr/terms' })).toEqual([]);
});
