// Configuration gate only: native testing, Apple contracts and reviewer approval
// must still be completed in App Store Connect. Never prints environment values.
require('./check-build-env.cjs');
const { storeProblems } = require('./store-config.cjs');
const problems = storeProblems(process.env);
if (problems.length) {
  console.error('Soumission non prête :\n' + problems.join('\n'));
  process.exit(1);
}
console.log('Configuration de fiche store complète. Valider encore le dossier docs/APP-STORE-RELEASE.md, les appareils physiques et les achats Sandbox avant soumission.');
