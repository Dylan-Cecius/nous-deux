import { initializeApp } from 'firebase-admin/app';

// Entrée de déploiement des fonctions essentielles, sans les secrets des services facultatifs.
initializeApp();
export { createCouple, createInvitation, joinCouple, submitDailyAnswer, setAiConsent, registerPushToken, notifyPartner, deleteAccount, retryAccountDeletions } from './security';
