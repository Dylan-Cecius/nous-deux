const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { PROJECT_ID, assertEmulatorEnvironment } = require('./emulator-guard.cjs');

const localEnvironment = {
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8088',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9098',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9198',
};

test('accepts the configured local endpoints without changing the environment', () => {
  const env = Object.freeze({ ...localEnvironment, GCLOUD_PROJECT: PROJECT_ID, GOOGLE_CLOUD_PROJECT: PROJECT_ID, FIREBASE_EMULATOR_HUB: '127.0.0.1:4400' });
  assert.deepEqual(assertEmulatorEnvironment(env, PROJECT_ID), {
    firestore: { host: '127.0.0.1', port: 8088 },
    auth: { host: '127.0.0.1', port: 9098 },
    storage: { host: '127.0.0.1', port: 9198 },
  });
});

test('accepts exact localhost and bracketed IPv6 loopback with explicit ports', () => {
  const result = assertEmulatorEnvironment({ ...localEnvironment,
    FIRESTORE_EMULATOR_HOST: 'localhost:1', FIREBASE_STORAGE_EMULATOR_HOST: '[::1]:65535',
  }, PROJECT_ID);
  assert.deepEqual(result.firestore, { host: 'localhost', port: 1 });
  assert.deepEqual(result.storage, { host: '::1', port: 65535 });
});

test('rejects a different project even with local addresses', () => {
  for (const projectId of [undefined, '', 'production', 'demo-other']) {
    assert.throws(() => assertEmulatorEnvironment(localEnvironment, projectId), /EMULATOR_SAFETY/);
  }
  for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
    assert.throws(() => assertEmulatorEnvironment({ ...localEnvironment, [name]: 'production' }, PROJECT_ID), /EMULATOR_SAFETY/);
  }
});

for (const variable of [...Object.keys(localEnvironment), 'FIREBASE_EMULATOR_HUB']) {
  test(`rejects unsafe or malformed values of ${variable}`, () => {
    for (const value of ['', 'remote.invalid:443', '192.168.1.1:8088', '0.0.0.0:8088',
      'http://127.0.0.1:8088', 'https://localhost:8088', 'user:secret@localhost:8088',
      'localhost:8088/path', 'localhost:8088?token=secret', 'localhost:8088#fragment',
      'localhost.remote.invalid:8088', '127.1:8088', '2130706433:8088', '::1:8088',
      'localhost', 'localhost:0', 'localhost:-1', 'localhost:65536', 'localhost:08088',
      ' localhost:8088', 'localhost:8088\n', 'localhost:8e3', 'localhost:8088:90', 8088, null]) {
      assert.throws(() => assertEmulatorEnvironment({ ...localEnvironment, [variable]: value }, PROJECT_ID), /EMULATOR_SAFETY/);
    }
  });
}

test('rejects each missing required endpoint without exposing its value', () => {
  for (const variable of Object.keys(localEnvironment)) {
    const env = { ...localEnvironment }; delete env[variable];
    assert.throws(() => assertEmulatorEnvironment(env, PROJECT_ID), /EMULATOR_SAFETY/);
  }
  assert.throws(() => assertEmulatorEnvironment({ ...localEnvironment, FIRESTORE_EMULATOR_HOST: 'secret@remote.invalid:443' }, PROJECT_ID),
    error => !error.message.includes('secret') && !error.message.includes('remote.invalid'));
});

// Stop BEFORE any SDK module can load. Even a failing regression cannot access
// the network, initialize Firebase or execute the destructive emulator fixtures.
for (const variable of Object.keys(localEnvironment)) {
  test(`security entrypoint rejects non-local ${variable} before loading any SDK`, () => {
    const result = spawnSync(process.execPath, ['-e', `
      const Module = require('node:module');
      const originalLoad = Module._load;
      Module._load = function (id, ...args) {
        if (id.startsWith('firebase') || id.startsWith('@firebase/')) {
          throw new Error('SDK_LOADED_BEFORE_GUARD');
        }
        return originalLoad.call(this, id, ...args);
      };
      try {
        require('./security.test.cjs');
        process.exitCode = 2;
      } catch (error) {
        process.stderr.write(error.message);
        process.exitCode = 1;
      }
    `], {
      cwd: __dirname,
      env: { ...localEnvironment, [variable]: 'remote.invalid:443' },
      encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /EMULATOR_SAFETY/);
    assert.doesNotMatch(result.stderr, /SDK_LOADED_BEFORE_GUARD/);
  });
}
