/** Native permissions must match the features actually shipped in this build. */
module.exports = ({ config }) => {
  const assistantEnabled = process.env.EXPO_PUBLIC_ASSISTANT_ENABLED === 'true';
  const excluded = require('./package.json').expo?.autolinking?.exclude ?? [];
  const voiceEnabled = assistantEnabled && !excluded.includes('expo-speech-recognition');
  if (voiceEnabled) return config;

  const infoPlist = { ...config.ios?.infoPlist };
  delete infoPlist.NSMicrophoneUsageDescription;
  delete infoPlist.NSSpeechRecognitionUsageDescription;

  return {
    ...config,
    ios: { ...config.ios, infoPlist },
    android: {
      ...config.android,
      permissions: (config.android?.permissions ?? []).filter(permission => permission !== 'android.permission.RECORD_AUDIO'),
      blockedPermissions: [...new Set([...(config.android?.blockedPermissions ?? []), 'android.permission.RECORD_AUDIO'])],
    },
    plugins: (config.plugins ?? [])
      .filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-speech-recognition')
      .map(plugin => {
        const name = Array.isArray(plugin) ? plugin[0] : plugin;
        if (name !== 'expo-image-picker') return plugin;
        return [name, {
          ...(Array.isArray(plugin) ? plugin[1] : {}),
          ...(!assistantEnabled && {
            photosPermission: 'Nous Deux utilise uniquement les photos que tu choisis pour vos souvenirs ou votre photo de couple.',
            cameraPermission: 'Nous Deux utilise l’appareil photo pour prendre une photo à ajouter à vos souvenirs.',
          }),
          microphonePermission: false,
        }];
      }),
  };
};
