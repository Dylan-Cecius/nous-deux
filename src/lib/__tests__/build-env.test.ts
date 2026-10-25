import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = resolve(__dirname, '../../../scripts/check-build-env.cjs');
const required = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID'];
const flags = ['EXPO_PUBLIC_ASSISTANT_ENABLED', 'EXPO_PUBLIC_PLACES_ENABLED'];
// Only fictitious configuration is passed to the child process; no inherited credentials.
const configured = Object.fromEntries(required.map(name => [`EXPO_PUBLIC_FIREBASE_${name}`, 'fictitious-value']));
const check = (extra: Partial<NodeJS.ProcessEnv> = {}) => spawnSync(process.execPath, [script], {
  env: { NODE_ENV: 'test', ...configured, ...extra }, encoding: 'utf8', timeout: 5000,
});

test.each(flags)('la build refuse l’activation du service payant %s', name => {
  const result = check({ [name]: 'true' });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(name);
  expect(result.stderr).toContain('désactivé');
  expect(result.stdout).not.toContain('vérifiée');
});

test.each([{}, { EXPO_PUBLIC_ASSISTANT_ENABLED: 'false', EXPO_PUBLIC_PLACES_ENABLED: 'false' },
  { EXPO_PUBLIC_ASSISTANT_ENABLED: '', EXPO_PUBLIC_PLACES_ENABLED: '' }])(
  'la configuration Firebase complète et les fonctions inactives restent acceptées : %j', extra => {
    const result = check(extra);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('vérifiée');
  },
);

test.each(flags)('une valeur invalide de %s est refusée sans afficher son contenu', name => {
  const result = check({ [name]: 'private-fictitious-diagnostic' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(name);
  expect(result.stderr + result.stdout).not.toContain('private-fictitious-diagnostic');
});

test.each(required)('la build refuse la configuration Firebase incomplète : %s', name => {
  const result = check({ [`EXPO_PUBLIC_FIREBASE_${name}`]: '  ' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(name);
  expect(result.stderr + result.stdout).not.toContain('fictitious-value');
});
