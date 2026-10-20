// Pure preflight: no Firebase import, credential lookup, DNS or network call.
const PROJECT_ID = 'demo-nous-deux-security';

function reject(reason) {
  // Never echo environment values: a malformed address could contain a secret.
  throw new Error(`EMULATOR_SAFETY: ${reason}. Aucun accès au cloud réel.`);
}

function localEndpoint(value, name) {
  // Deliberately narrow grammar, not URL normalization (which accepts alternate
  // IP representations, credentials and paths). Require an explicit local port.
  const match = typeof value === 'string' && /^(127\.0\.0\.1|localhost|\[::1\]):([1-9][0-9]{0,4})$/.exec(value);
  if (!match || Number(match[2]) > 65535) reject(`${name} doit désigner un émulateur local avec un port valide`);
  return { host: match[1] === '[::1]' ? '::1' : match[1], port: Number(match[2]) };
}

function assertEmulatorEnvironment(env, projectId) {
  if (projectId !== PROJECT_ID) reject('projet de test non autorisé');
  for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
    if (env[name] !== undefined && env[name] !== PROJECT_ID) reject(`${name} ne correspond pas au projet de démonstration`);
  }
  const firestore = localEndpoint(env.FIRESTORE_EMULATOR_HOST, 'FIRESTORE_EMULATOR_HOST');
  const auth = localEndpoint(env.FIREBASE_AUTH_EMULATOR_HOST, 'FIREBASE_AUTH_EMULATOR_HOST');
  const storage = localEndpoint(env.FIREBASE_STORAGE_EMULATOR_HOST, 'FIREBASE_STORAGE_EMULATOR_HOST');
  if (env.FIREBASE_EMULATOR_HUB !== undefined) localEndpoint(env.FIREBASE_EMULATOR_HUB, 'FIREBASE_EMULATOR_HUB');
  return { firestore, auth, storage };
}

module.exports = { PROJECT_ID, assertEmulatorEnvironment };
