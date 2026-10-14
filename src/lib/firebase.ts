import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth, type Persistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Les valeurs viennent du fichier .env (voir .env.example et le README).
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** Vrai quand Firebase est configuré : la synchro entre les deux téléphones est alors possible. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let services: { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage; functions: Functions } | null = null;

export function firebase() {
  if (!isFirebaseConfigured) throw new Error('Firebase n’est pas configuré');
  if (services) return services;

  const app = getApps()[0] ?? initializeApp(config);
  let auth: Auth;
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    // getReactNativePersistence n'existe que dans le build React Native de firebase/auth,
    // les types TypeScript par défaut (web) ne le déclarent pas.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
    };
    try {
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      // Déjà initialisé (rechargement à chaud pendant le développement).
      auth = getAuth(app);
    }
  }
  services = {
    app,
    auth,
    db: getFirestore(app),
    storage: getStorage(app),
    // Même région que les Cloud Functions (functions/src/index.ts).
    functions: getFunctions(app, 'europe-west1'),
  };
  return services;
}
