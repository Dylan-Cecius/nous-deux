/** Public operator details. Never infer these from a GitHub or Expo username. */
export const legalEntity = process.env.EXPO_PUBLIC_LEGAL_ENTITY?.trim() || null;
const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ?? '';
export const supportEmail = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null;
export const legalUpdatedAt = '12 novembre 2026';
