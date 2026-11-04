import config from '@/constants/public-info.json';
import { getPublicSupportLinks, getSupportContact } from '../public-info';

const original = { ...config };
beforeEach(() => Object.assign(config, {
  ...original,
  publicationStatus: 'published',
  siteUrl: 'https://support.example.com',
  operatorLegalName: 'Éditeur de test',
  securityRetention: 'Durée vérifiée',
  supportRetention: 'Durée vérifiée',
  backupRetention: 'Durée vérifiée',
  retentionVerified: true,
}));
afterEach(() => Object.assign(config, original));

test('le contact reste disponible quand les pages sont encore privées', () => {
  config.publicationStatus = 'draft';
  expect(getPublicSupportLinks()).toBeNull();
  expect(getSupportContact()?.email).toBe(original.supportEmail);
});

test('une configuration publique complète fournit les trois pages', () => {
  expect(getPublicSupportLinks()).toEqual({
    support: 'https://support.example.com/',
    privacy: 'https://support.example.com/confidentialite/',
    deletion: 'https://support.example.com/suppression/',
  });
});

test.each(['operatorLegalName', 'operatorAddress', 'securityRetention', 'supportRetention', 'backupRetention'] as const)(
  'une information manquante bloque les liens : %s', (field) => {
    config[field] = '   ';
    expect(getPublicSupportLinks()).toBeNull();
  },
);

test('les durées doivent avoir été vérifiées explicitement', () => {
  config.retentionVerified = false;
  expect(getPublicSupportLinks()).toBeNull();
  Object.assign(config, { retentionVerified: 'false' });
  expect(getPublicSupportLinks()).toBeNull();
});

test.each(['adresse-invalide', 'support@example.com?bcc=autre@example.com'])(
  'un contact invalide bloque les liens publics : %s', (email) => {
    config.supportEmail = email;
    expect(getSupportContact()).toBeNull();
    expect(getPublicSupportLinks()).toBeNull();
  },
);

test.each([
  'http://support.example.com',
  'https://identifiant:secret@support.example.com',
  'https://support.example.com?token=prive',
  'https://support.example.com#prive',
  'url-invalide',
])('une URL impropre à la publication est refusée : %s', (url) => {
  config.siteUrl = url;
  expect(getPublicSupportLinks()).toBeNull();
});
