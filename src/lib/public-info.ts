import config from '@/constants/public-info.json';

// The owner-private preview must never appear as a public support resource.
export function getPublicSupportLinks() {
  if (config.publicationStatus !== 'published' || !config.retentionVerified ||
      !config.operatorName.trim() || !config.operatorAddress.trim() ||
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
