const { initializeApp } = require('firebase-admin/app');
const { migrateSecurity } = require('../lib/migration');
const args = process.argv.slice(2);
const project = args[args.indexOf('--project') + 1];
if (!args.includes('--project') || !project || project.startsWith('--')) {
  console.error('Usage: npm run migrate:security -- --project PROJECT_ID [--apply]');
  process.exit(1);
}
initializeApp({ projectId: project });
migrateSecurity(args.includes('--apply')).then((summary) => console.log(JSON.stringify(summary)))
  .catch((error) => { console.error(error.message); process.exitCode = 1; });
