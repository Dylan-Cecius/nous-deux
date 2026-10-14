// Activer uniquement après déploiement et validation du fournisseur correspondant.
// Ces indicateurs publics ne contiennent aucune clé API privée.
export const features = {
  assistant: process.env.EXPO_PUBLIC_ASSISTANT_ENABLED === 'true',
  places: process.env.EXPO_PUBLIC_PLACES_ENABLED === 'true',
};
