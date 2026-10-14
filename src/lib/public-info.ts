import config from '@/constants/public-info.json';

/** A confirmed contact stays usable even while the website is private. */
export function getSupportContact() {
  const email = config.supportEmail.trim();
  if (!/^[^\s@?&#%]+@[^\s@?&#%]+\.[^\s@?&#%]+$/.test(email)) return null;
  return { email, operator: config.operatorName.trim(), mailto: `mailto:${email}?subject=${encodeURIComponent('Nous Deux — Assistance')}` };
}

// The owner-private preview must never appear as a public support resource.
export function getPublicSupportLinks() {
  if (config.publicationStatus !== 'published' || !config.retentionVerified ||
      !config.operatorName.trim() || !config.operatorLegalName.trim() || !config.operatorAddress.trim() ||
      !config.supportEmail.trim() || !config.securityRetention.trim() ||
      !config.supportRetention.trim() || !config.backupRetention.trim()) return null;
  try {
    const url = new URL(config.siteUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return {
      support: new URL('/', url).href,
      privacy: new URL('/confidentialite/', url).href,
      deletion: new URL('/suppression/', url).href,
    };
  } catch {
    return null;
  }
}
