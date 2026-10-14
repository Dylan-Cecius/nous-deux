// Évite de distribuer involontairement une app limitée au mode local.
const required = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID'];
const missing = required.filter((key) => !process.env['EXPO_PUBLIC_FIREBASE_' + key]?.trim());
if (missing.length) {
  console.error('Build interrompu : configuration Firebase absente (' + missing.join(', ') + ').');
  console.error('Configurer les variables EXPO_PUBLIC_FIREBASE_* dans l’environnement EAS du profil.');
  process.exit(1);
}
for (const name of ['EXPO_PUBLIC_ASSISTANT_ENABLED', 'EXPO_PUBLIC_PLACES_ENABLED']) {
  if (process.env[name] && !['true', 'false'].includes(process.env[name])) {
    console.error('Indicateur invalide : ' + name + '. Utiliser true ou false.');
    process.exit(1);
  }
}
console.log('Configuration de distribution vérifiée.');
