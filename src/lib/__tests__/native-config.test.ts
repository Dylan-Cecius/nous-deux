import type { ExpoConfig } from 'expo/config';

// Configuration only: no Expo command, plugin execution, prebuild or native build.
const configure = jest.requireActual('../../../app.config.js') as (args: { config: ExpoConfig }) => ExpoConfig;
const shipped = jest.requireActual('../../../app.json').expo as ExpoConfig;
const manifest = jest.requireActual('../../../package.json');
const originalFlag = process.env.EXPO_PUBLIC_ASSISTANT_ENABLED;

afterEach(() => {
  if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_ASSISTANT_ENABLED;
  else process.env.EXPO_PUBLIC_ASSISTANT_ENABLED = originalFlag;
});

const pluginName = (plugin: NonNullable<ExpoConfig['plugins']>[number]) => Array.isArray(plugin) ? plugin[0] : plugin;
const withoutVoice = (config: ExpoConfig) => {
  expect(config.ios?.infoPlist).not.toHaveProperty('NSMicrophoneUsageDescription');
  expect(config.ios?.infoPlist).not.toHaveProperty('NSSpeechRecognitionUsageDescription');
  expect(config.android?.permissions).not.toContain('android.permission.RECORD_AUDIO');
  expect(config.android?.blockedPermissions?.filter(permission => permission === 'android.permission.RECORD_AUDIO')).toHaveLength(1);
  expect(config.plugins?.map(pluginName) ?? []).not.toContain('expo-speech-recognition');
};

test.each([undefined, 'false', 'FALSE', 'true'])('la configuration actuelle exclut le module vocal, indicateur %s', (flag) => {
  // Even a true flag cannot silently reintroduce a module explicitly excluded from autolinking.
  if (flag === undefined) delete process.env.EXPO_PUBLIC_ASSISTANT_ENABLED;
  else process.env.EXPO_PUBLIC_ASSISTANT_ENABLED = flag;
  expect(manifest.expo.autolinking.exclude).toContain('expo-speech-recognition');
  const before = JSON.stringify(shipped);
  const result = configure({ config: shipped });
  withoutVoice(result);
  const picker = result.plugins?.find(plugin => pluginName(plugin) === 'expo-image-picker');
  expect(Array.isArray(picker) && picker[1].microphonePermission).toBe(false);
  expect(JSON.stringify(shipped)).toBe(before);
  expect(result.ios?.bundleIdentifier).toBe(shipped.ios?.bundleIdentifier);
  expect(result.android?.package).toBe(shipped.android?.package);
});

test('assistant désactivé : la lecture locale de planning conserve les permissions photo sans micro', () => {
  process.env.EXPO_PUBLIC_ASSISTANT_ENABLED = 'false';
  const result = configure({ config: shipped });
  const picker = result.plugins?.find(plugin => pluginName(plugin) === 'expo-image-picker');
  expect(Array.isArray(picker)).toBe(true);
  if (!Array.isArray(picker)) throw new Error('Plugin photo attendu');
  expect(picker[1].photosPermission).toContain('photos que tu choisis');
  expect(picker[1].cameraPermission).toContain('souvenirs');
  expect(picker[1].photosPermission).toContain('lecture locale');
  expect(picker[1].cameraPermission).toContain('planning sur cet appareil');
  expect(picker[1].microphonePermission).toBe(false);
});

test('les formes simples et configurées des plugins sont filtrées sans perdre les autres options', () => {
  process.env.EXPO_PUBLIC_ASSISTANT_ENABLED = 'false';
  const config: ExpoConfig = {
    name: 'Application fictive', slug: 'application-fictive',
    ios: { infoPlist: { NSMicrophoneUsageDescription: 'fictif', NSSpeechRecognitionUsageDescription: 'fictif', ITSAppUsesNonExemptEncryption: false } },
    android: { permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'], blockedPermissions: ['android.permission.READ_CONTACTS', 'android.permission.RECORD_AUDIO'] },
    plugins: ['expo-speech-recognition', ['expo-speech-recognition', { microphonePermission: 'fictif' }], ['expo-image-picker', { customOption: 'conservée' }], ['expo-notifications', { color: '#123456' }], 'expo-router'],
  };
  const before = JSON.stringify(config);
  const result = configure({ config });
  withoutVoice(result);
  expect(result.android?.permissions).toEqual(['android.permission.CAMERA']);
  expect(result.android?.blockedPermissions).toContain('android.permission.READ_CONTACTS');
  expect(result.ios?.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
  expect(result.plugins).toContainEqual(['expo-notifications', { color: '#123456' }]);
  expect(result.plugins).toContain('expo-router');
  expect(result.plugins?.find(plugin => pluginName(plugin) === 'expo-image-picker')).toEqual(['expo-image-picker', expect.objectContaining({ customOption: 'conservée', microphonePermission: false })]);
  expect(JSON.stringify(config)).toBe(before);
});

test('la forme simple du plugin photo reçoit aussi une permission micro désactivée', () => {
  process.env.EXPO_PUBLIC_ASSISTANT_ENABLED = 'false';
  const result = configure({ config: { name: 'Fictif', slug: 'fictif', plugins: ['expo-image-picker'] } });
  withoutVoice(result);
  expect(result.plugins).toEqual([['expo-image-picker', expect.objectContaining({ microphonePermission: false })]]);
});

test('configuration minimale et appels répétés restent stables', () => {
  process.env.EXPO_PUBLIC_ASSISTANT_ENABLED = 'false';
  const minimal = { name: 'Fictif', slug: 'fictif' };
  const result = configure({ config: minimal });
  withoutVoice(result);
  expect(configure({ config: result })).toEqual(result);
  expect(minimal).toEqual({ name: 'Fictif', slug: 'fictif' });
});
