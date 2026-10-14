import type { ExpoSpeechRecognitionModule as Module } from 'expo-speech-recognition';

// La reconnaissance vocale est un module natif : il n'existe pas dans Expo Go.
// On le charge prudemment pour que l'app continue de fonctionner sans (saisie au clavier).
let speech: typeof Module | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speech = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch {
  speech = null;
}

export const voiceSupported = speech !== null;

/**
 * Écoute en français. `onText` reçoit le texte au fur et à mesure, `onEnd` le texte final.
 * Renvoie une fonction pour arrêter l'écoute.
 */
export async function listen(handlers: {
  onText: (text: string) => void;
  onEnd: (finalText: string) => void;
  onError: (message: string) => void;
}): Promise<() => void> {
  if (!speech) {
    handlers.onError('La dictée vocale n’est pas disponible dans cette version de l’app.');
    return () => {};
  }
  const permission = await speech.requestPermissionsAsync();
  if (!permission.granted) {
    handlers.onError('Autorise le micro dans les réglages du téléphone pour utiliser la dictée.');
    return () => {};
  }

  let last = '';
  const subs = [
    speech.addListener('result', (event) => {
      last = event.results[0]?.transcript ?? last;
      handlers.onText(last);
    }),
    speech.addListener('error', (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') handlers.onError(event.message);
    }),
    speech.addListener('end', () => {
      subs.forEach((s) => s.remove());
      handlers.onEnd(last);
    }),
  ];
  speech.start({ lang: 'fr-FR', interimResults: true, continuous: false });
  return () => speech?.stop();
}
