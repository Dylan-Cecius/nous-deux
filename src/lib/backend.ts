import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  reauthenticateWithCredential,
  signOut as firebaseSignOut,
  EmailAuthProvider,
  linkWithCredential,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Platform } from 'react-native';

import { firebase, isFirebaseConfigured } from './firebase';
import { clearReminders } from './notifications';
import { toCompactDataUri } from './photos';
import {
  PRIVATE_COLLECTIONS,
  type Answer,
  type AgendaEvent,
  type CollectionName,
  type Collections,
  type Couple,
  type Member,
  type PhotoFrame,
} from './types';

/**
 * Toute l'app passe par cette interface. Deux implémentations :
 * - « cloud » (Firebase) : les données sont partagées entre les deux téléphones ;
 * - « local » : tout reste sur ce téléphone (mode démo, sans compte Firebase).
 */
export interface Backend {
  mode: 'local' | 'cloud';
  userId: string;
  coupleId: string;
  subscribeCouple(cb: (couple: Couple | null) => void, onError?: (error: unknown) => void): () => void;
  updateCouple(patch: { since?: string; photoUrl?: string; photoFrame?: PhotoFrame }): Promise<void>;
  updateMember(memberId: string, patch: Partial<Omit<Member, 'id'>>): Promise<void>;
  subscribe<K extends CollectionName>(col: K, cb: (items: Collections[K][]) => void, onError?: (error: unknown) => void): () => void;
  add<K extends CollectionName>(col: K, data: Omit<Collections[K], 'id'>): Promise<void>;
  /** Ajoute toute une série d'horaires, ou aucun, pour éviter les doublons après un échec partiel. */
  addEvents(events: Omit<AgendaEvent, 'id'>[]): Promise<void>;
  /** Supprime au plus 52 horaires dans une seule écriture, sans lot partiel. */
  removeEvents(ids: string[]): Promise<void>;
  update<K extends CollectionName>(col: K, id: string, patch: Partial<Collections[K]>): Promise<void>;
  remove(col: CollectionName, id: string): Promise<void>;
  /** Enregistre une photo (Firebase Storage, ou dossier de l'app en mode local) et renvoie son adresse. */
  uploadPhoto(localUri: string): Promise<string>;
  /** Appelle une Cloud Function (assistant IA, recherche de restos). Mode cloud uniquement. */
  call<T>(name: string, data: object): Promise<T>;
}

/** Erreur d'envoi de photo, avec un message compréhensible. */
export class PhotoUploadError extends Error {
  constructor() {
    super('La photo n’a pas pu être envoyée. Vérifie ta connexion et réessaie.');
  }
}

/**
 * Firebase Storage demande le forfait Blaze. Tant qu'il n'est pas activé, l'envoi échoue avec
 * l'une de ces erreurs : on bascule alors sur les photos rangées dans Firestore.
 */
let storageAvailable = true;
function isStorageUnavailable(e: unknown) {
  const code = (e as { code?: string })?.code ?? '';
  return ['storage/unknown', 'storage/unauthorized', 'storage/bucket-not-found', 'storage/project-not-found'].includes(code);
}

/**
 * Lit un fichier local en Blob. Sur téléphone, `fetch(uri).blob()` produit des Blob que
 * Firebase Storage n'arrive pas à envoyer : XMLHttpRequest est la méthode fiable.
 */
function readAsBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Lecture de la photo impossible'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Messages lisibles pour les appels aux Cloud Functions (assistant, recherche de restos).
 * Les erreurs volontaires du serveur (HttpsError) ont déjà un message en français : on le garde.
 */
function functionMessage(e: unknown): string {
  const { code = '', message = '' } = (e as { code?: string; message?: string }) ?? {};
  switch (code) {
    case 'functions/not-found':
      return 'Cette fonction n’est pas encore disponible. Réessaie après la mise à jour du service.';
    case 'functions/internal':
      return 'L’opération n’a pas abouti. Réessaie dans un instant.';
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return 'Le service ne répond pas pour le moment. Vérifie ta connexion et réessaie.';
    case 'functions/failed-precondition':
    case 'functions/already-exists':
    case 'functions/unauthenticated':
    case 'functions/resource-exhausted':
    case 'functions/invalid-argument':
    case 'functions/permission-denied':
      return message || 'Demande impossible pour le moment.';
    default:
      return 'Une erreur est survenue. Réessaie dans un instant.';
  }
}

export class CloudOnlyError extends Error {
  constructor() {
    super('Cette fonction est disponible dans un espace synchronisé.');
  }
}

type Session = { mode: 'local' } | { mode: 'cloud'; coupleId: string; userId: string };

const SESSION_KEY = 'session';

const validDocumentId = (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0 && !id.includes('/');

function serverCoupleId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (!validDocumentId(value)) throw new Error('Le rattachement de ce compte est illisible. Réessaie ou contacte l’assistance.');
  return value;
}

function hasMember(data: unknown, userId: string): boolean {
  if (data == null) return false;
  const members = typeof data === 'object' ? (data as { members?: unknown }).members : undefined;
  if (!Array.isArray(members) || !members.every(validDocumentId)) {
    throw new Error('La liste des membres de cet espace est illisible. Réessaie ou contacte l’assistance.');
  }
  return members.includes(userId);
}

function parseSession(raw: string): Session {
  const invalid = () => new Error('La session enregistrée est illisible. Réessaie ou contacte l’assistance avant de la réinitialiser.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw invalid(); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const saved = value as Record<string, unknown>;
  if (saved.mode === 'local') return { mode: 'local' };
  if (saved.mode !== 'cloud' || !validDocumentId(saved.userId) || !validDocumentId(saved.coupleId)) throw invalid();
  return { mode: 'cloud', userId: saved.userId, coupleId: saved.coupleId };
}

// Auth et la clé de session sont partagés par tous les écrans. Une ancienne
// restauration/déconnexion doit terminer avant qu’une nouvelle session soit créée.
let sessionWork: Promise<void> = Promise.resolve();
function withSession<T>(action: () => Promise<T>): Promise<T> {
  const task = sessionWork.then(action);
  sessionWork = task.then(() => {}, () => {});
  return task;
}

function requireCurrentUser(auth: ReturnType<typeof firebase>['auth'], expectedUid: string) {
  if (auth.currentUser?.uid !== expectedUid) {
    throw new Error('Le compte a changé. Rouvre la connexion avant de réessayer.');
  }
}

export async function loadSession(): Promise<Backend | null> {
  return withSession(loadSessionNow);
}

async function loadSessionNow(): Promise<Backend | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  const session = parseSession(raw);
  if (session.mode === 'local') return localBackend();
  const { auth, db } = firebase();
  await auth.authStateReady();
  if (!auth.currentUser) {
    await clearSessionNow();
    return null;
  }
  requireCurrentUser(auth, session.userId);
  try {
    // L'index serveur est la référence après une migration ou un changement d'appareil.
    // Un ancien identifiant local ne doit pas déconnecter un compte anonyme récupérable.
    const index = await getDoc(doc(db, 'users', session.userId));
    requireCurrentUser(auth, session.userId);
    const coupleId = serverCoupleId(index.data()?.coupleId) ?? session.coupleId;
    const couple = await getDoc(doc(db, 'couples', coupleId));
    requireCurrentUser(auth, session.userId);
    if (!hasMember(couple.data(), session.userId)) {
      await clearSessionNow();
      return null;
    }
    if (coupleId !== session.coupleId) await saveCloudSession(coupleId, session.userId);
    requireCurrentUser(auth, session.userId);
    return cloudBackend(coupleId, session.userId);
  } catch (error) {
    requireCurrentUser(auth, session.userId);
    if ((error as { code?: string }).code === 'permission-denied') {
      await clearSessionNow();
      return null;
    }
    throw error;
  }
}

export async function clearSession() {
  return withSession(clearSessionNow);
}

// Réservé aux opérations qui détiennent déjà le passage de session (pas de verrou imbriqué).
async function clearSessionNow() {
  if (isFirebaseConfigured) await firebaseSignOut(firebase().auth);
  await AsyncStorage.removeItem(SESSION_KEY);
  await clearReminders().catch(() => {});
}

async function callServer<T>(name: string, data: object): Promise<T> {
  try {
    return (await httpsCallable(firebase().functions, name)(data)).data as T;
  } catch (error) {
    throw new Error(functionMessage(error));
  }
}

// ---------------------------------------------------------------------------
// Mode local
// ---------------------------------------------------------------------------

const LOCAL_ME = 'me';
const LOCAL_PARTNER = 'partner';
const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<(value: any) => void>>();
const localWrites = new Map<string, Promise<void>>();
const localOperations = new Set<Promise<unknown>>();
const localBackends = new WeakMap<Backend, number>();
let localEpoch = 0;
let localReadVersion = 0;
let deletingLocal = false;
const localUnavailable = () => new Error('Cet espace local est fermé ou en cours de suppression.');

/** Bloque les nouveaux travaux pendant la suppression et suit ceux déjà engagés. */
function localOperation<T>(epoch: number, action: () => Promise<T>): Promise<T> {
  if (deletingLocal || epoch !== localEpoch) return Promise.reject(localUnavailable());
  const task = Promise.resolve().then(action);
  localOperations.add(task);
  void task.then(() => localOperations.delete(task), () => localOperations.delete(task));
  return task;
}

async function readLocal<T>(key: string, fallback: T): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T;
  const version = localReadVersion;
  const raw = await AsyncStorage.getItem(key);
  if (version !== localReadVersion) throw localUnavailable();
  // Une écriture ou une autre lecture peut avoir rempli le cache entre-temps.
  if (cache.has(key)) return cache.get(key) as T;
  const value = raw ? (JSON.parse(raw) as T) : fallback;
  cache.set(key, value);
  return value;
}

async function writeLocal<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
  cache.set(key, value);
  listeners.get(key)?.forEach((cb) => cb(value));
}

/** Sérialise lecture-modification-écriture par clé, sans bloquer les autres collections. */
function mutateLocal<T>(key: string, fallback: T, change: (current: T) => T): Promise<void> {
  const task = (localWrites.get(key) ?? Promise.resolve()).then(async () => {
    const current = await readLocal(key, fallback);
    const next = change(current);
    if (next !== current) await writeLocal(key, next);
  });
  // Une erreur reste visible à l'appelant, mais ne condamne pas les actions suivantes.
  const settled = task.then(() => {}, () => {});
  localWrites.set(key, settled);
  void settled.then(() => { if (localWrites.get(key) === settled) localWrites.delete(key); });
  return task;
}

function watchLocal<T>(epoch: number, key: string, fallback: T, cb: (value: T) => void, onError?: (error: unknown) => void) {
  if (epoch !== localEpoch || deletingLocal) {
    onError?.(localUnavailable());
    return () => {};
  }
  let active = true;
  let received = false;
  const receive = (value: T) => {
    if (!active || epoch !== localEpoch) return;
    received = true;
    cb(value);
  };
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(receive);
  readLocal(key, fallback).then(
    (value) => { if (!received) receive(value); },
    (error) => { if (active && epoch === localEpoch && !received) onError?.(error); },
  );
  return () => {
    active = false;
    listeners.get(key)?.delete(receive);
  };
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function eventRemovalIds(ids: string[]): string[] {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id.trim() || id.includes('/'))) {
    throw new Error('La sélection d’horaires est invalide. Recharge l’agenda avant de réessayer.');
  }
  const unique = [...new Set(ids)];
  if (unique.length > 52) throw new Error('Cette série dépasse 52 horaires. Aucune suppression effectuée. Contacte l’assistance.');
  return unique;
}

export async function createLocalCouple(me: Omit<Member, 'id'>, partner: Omit<Member, 'id'>) {
  if (deletingLocal) throw localUnavailable();
  return withSession(() => createLocalCoupleNow(me, partner));
}

async function createLocalCoupleNow(me: Omit<Member, 'id'>, partner: Omit<Member, 'id'>) {
  const couple: Couple = {
    id: 'local',
    members: [
      { id: LOCAL_ME, ...me },
      { id: LOCAL_PARTNER, ...partner },
    ],
  };
  return localOperation(localEpoch, async () => {
    await writeLocal('local:couple', couple);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ mode: 'local' } satisfies Session));
    return localBackend();
  });
}

function localBackend(): Backend {
  const colKey = (col: string) => `local:col:${col}`;
  const epoch = localEpoch;
  const operate = <T>(action: () => Promise<T>) => localOperation(epoch, action);
  const backend: Backend = {
    mode: 'local',
    userId: LOCAL_ME,
    coupleId: 'local',
    subscribeCouple: (cb, onError) => watchLocal<Couple | null>(epoch, 'local:couple', null, cb, onError),
    async updateCouple(patch) {
      await operate(() => mutateLocal<Couple | null>('local:couple', null, (couple) => couple ? { ...couple, ...patch } : couple));
    },
    async updateMember(memberId, patch) {
      await operate(() => mutateLocal<Couple | null>('local:couple', null, (couple) => couple ? {
        ...couple, members: couple.members.map((m) => m.id === memberId ? { ...m, ...patch } : m),
      } : couple));
    },
    subscribe: (col, cb, onError) => watchLocal(epoch, colKey(col), [], cb, onError),
    async add(col, data) {
      await operate(() => mutateLocal<any[]>(colKey(col), [], (items) => [...items, { ...data, id: newId() }]));
    },
    async addEvents(events) {
      if (!events.length || events.length > 52) throw new Error('Choisis entre 1 et 52 horaires.');
      await operate(() => mutateLocal<AgendaEvent[]>(colKey('events'), [], (items) => [...items, ...events.map((event) => ({ ...event, id: newId() }))]));
    },
    async removeEvents(ids) {
      const selected = new Set(eventRemovalIds(ids));
      if (!selected.size) return;
      await operate(() => mutateLocal<AgendaEvent[]>(colKey('events'), [], (items) => items.filter((event) => !selected.has(event.id))));
    },
    async update(col, id, patch) {
      await operate(() => mutateLocal<any[]>(colKey(col), [], (items) => items.map((it) => it.id === id ? { ...it, ...patch } : it)));
    },
    async remove(col, id) {
      await operate(() => mutateLocal<any[]>(colKey(col), [], (items) => items.filter((it) => it.id !== id)));
    },
    async uploadPhoto(localUri) {
      return operate(async () => {
        // Une URL blob disparaît au rechargement : conserver le contenu en mode local web.
        if (Platform.OS === 'web') return toCompactDataUri(localUri);
        // Le sélecteur d'images rend un fichier temporaire : on le copie dans le dossier de l'app.
        const { File, Paths } = await import('expo-file-system');
        const dest = new File(Paths.document, `photo-${newId()}.jpg`);
        await new File(localUri).copy(dest);
        return dest.uri;
      });
    },
    async call() {
      throw new CloudOnlyError();
    },
  };
  localBackends.set(backend, epoch);
  return backend;
}
// ---------------------------------------------------------------------------
// Mode cloud (Firebase)
// ---------------------------------------------------------------------------

type CoupleDoc = {
  members: string[];
  profiles: Record<string, { name: string; color: string; pushToken?: string }>;
  since?: string;
  photoUrl?: string;
  photoFrame?: PhotoFrame;
  createdAt: number;
};

async function ensureSignedIn(): Promise<string> {
  const { auth } = firebase();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

/** Firestore refuse les champs `undefined`. */
function clean<T extends object>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Mémorise sur ce téléphone le rattachement déjà enregistré par le serveur dans `users/{uid}`.
 */
async function saveCloudSession(coupleId: string, userId: string) {
  await AsyncStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ mode: 'cloud', coupleId, userId } satisfies Session),
  );
}

// ---------------------------------------------------------------------------
// Compte : sécuriser avec un e-mail, se reconnecter, supprimer
// ---------------------------------------------------------------------------

/** Compte Firebase de ce téléphone : anonyme (lié à ce seul appareil) ou sécurisé par e-mail. */
export function currentAccount(): { email: string | null; anonymous: boolean } | null {
  const user = firebase().auth.currentUser;
  return user ? { email: user.email, anonymous: user.isAnonymous } : null;
}

/** Messages lisibles pour les erreurs de connexion les plus courantes. */
function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Cette adresse e-mail est déjà utilisée par un autre compte.',
    'auth/invalid-email': 'Cette adresse e-mail n’est pas valide.',
    'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
    'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
    'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cette adresse e-mail.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.',
    'auth/network-request-failed': 'Pas de connexion Internet.',
    'auth/requires-recent-login': 'Par sécurité, déconnecte-toi puis reconnecte-toi avant de supprimer ton compte.',
  };
  return messages[code] ?? 'Une erreur est survenue. Réessaie.';
}

/**
 * Ajoute un e-mail et un mot de passe au compte de ce téléphone. Le compte garde le même
 * identifiant : toutes les données restent attachées, et on pourra se reconnecter ailleurs.
 */
export async function secureAccount(email: string, password: string) {
  const userId = firebase().auth.currentUser?.uid;
  return withSession(() => secureAccountNow(email, password, userId));
}

async function secureAccountNow(email: string, password: string, expectedUserId: string | undefined) {
  const { auth } = firebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Aucun compte sur ce téléphone.');
  if (user.uid !== expectedUserId) throw new Error('Le compte a changé. Rouvre le formulaire avant de réessayer.');
  try {
    await linkWithCredential(user, EmailAuthProvider.credential(email.trim(), password));
  } catch (e) {
    throw new Error(authMessage(e));
  }
}

/** Se reconnecter (nouveau téléphone, réinstallation) et retrouver son espace. */
export async function signInWithEmail(email: string, password: string): Promise<Backend> {
  return withSession(() => signInWithEmailNow(email, password));
}

async function signInWithEmailNow(email: string, password: string): Promise<Backend> {
  const { auth } = firebase();
  let uid: string;
  try {
    uid = (await signInWithEmailAndPassword(auth, email.trim(), password)).user.uid;
  } catch (e) {
    throw new Error(authMessage(e));
  }
  const restored = await recoverCloudSession(uid);
  if (!restored) throw new Error('Ce compte n’est relié à aucun espace de couple.');
  return restored;
}

/** Une réponse perdue ou une panne de stockage ne doit pas rejouer une invitation consommée. */
async function recoverCloudSession(uid: string): Promise<Backend | null> {
  const { auth, db } = firebase();
  requireCurrentUser(auth, uid);
  try {
    const index = await getDoc(doc(db, 'users', uid));
    requireCurrentUser(auth, uid);
    const coupleId = serverCoupleId(index.data()?.coupleId);
    if (coupleId == null) return null;
    // Un ancien index ne suffit pas : vérifier l’espace avant de quitter la connexion.
    const couple = await getDoc(doc(db, 'couples', coupleId));
    requireCurrentUser(auth, uid);
    if (!hasMember(couple.data(), uid)) {
      throw new Error('Ton compte n’a plus accès à cet espace. Contacte l’assistance si cela te semble anormal.');
    }
    await saveCloudSession(coupleId, uid);
    requireCurrentUser(auth, uid);
    return cloudBackend(coupleId, uid);
  } catch (error) {
    requireCurrentUser(auth, uid);
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') {
      throw new Error('Ton compte n’a plus accès à cet espace. Contacte l’assistance si cela te semble anormal.');
    }
    if (code === 'unavailable' || code === 'deadline-exceeded') {
      throw new Error('Impossible de retrouver votre espace pour le moment. Vérifie ta connexion et réessaie.');
    }
    throw error;
  }
}

export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(firebase().auth, email.trim());
  } catch (e) {
    throw new Error(authMessage(e));
  }
}

/** Supprime côté serveur ; le nettoyage continue automatiquement après une panne. */
export async function deleteMyAccount(backend: Backend, password?: string): Promise<'complete' | 'pending'> {
  if (backend.mode === 'local' && (deletingLocal || localBackends.get(backend) !== localEpoch)) throw localUnavailable();
  return withSession(() => deleteMyAccountNow(backend, password));
}

async function deleteMyAccountNow(backend: Backend, password?: string): Promise<'complete' | 'pending'> {
  if (backend.mode === 'local') {
    if (deletingLocal || localBackends.get(backend) !== localEpoch) throw localUnavailable();
    deletingLocal = true;
    localReadVersion++;
    try {
      // Les écritures/copies déjà engagées finissent avant l'inventaire à effacer.
      await Promise.allSettled([...localOperations]);
      if (Platform.OS !== 'web') {
        const { Directory, Paths } = await import('expo-file-system');
        for (const file of new Directory(Paths.document).list()) {
          if (file.name.startsWith('photo-')) file.delete();
        }
      }
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('local:'));
      await AsyncStorage.multiRemove(keys);
      await clearSessionNow();
      localEpoch++;
      listeners.clear();
      return 'complete';
    } finally {
      cache.clear();
      localReadVersion++;
      deletingLocal = false;
    }
  }
  const { auth } = firebase();
  const user = auth.currentUser;
  if (!user || user.uid !== backend.userId) throw new Error('Reconnecte-toi avant de supprimer ton compte.');
  if (!user.isAnonymous) {
    if (!password || !user.email) throw new Error('Confirme ton mot de passe avant de supprimer ton compte.');
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      requireCurrentUser(auth, backend.userId);
      await user.getIdToken(true);
    } catch (error) {
      requireCurrentUser(auth, backend.userId);
      throw new Error(authMessage(error));
    }
  }
  requireCurrentUser(auth, backend.userId);
  const result = await callServer<{ status: 'complete' | 'pending' }>('deleteAccount', { coupleId: backend.coupleId, expectedUserId: backend.userId });
  // Le serveur peut avoir invalidé le compte supprimé, mais jamais nettoyer un autre compte.
  if (auth.currentUser) requireCurrentUser(auth, backend.userId);
  await clearSessionNow();
  return result.status;
}

export async function createCloudCouple(me: Omit<Member, 'id'>) {
  return withSession(() => createCloudCoupleNow(me));
}

async function createCloudCoupleNow(me: Omit<Member, 'id'>) {
  const uid = await ensureSignedIn();
  const restored = await recoverCloudSession(uid);
  if (restored) return restored;
  return finishCloudOnboarding(uid, 'createCouple', { profile: { name: me.name, color: me.color } });
}

export async function joinCloudCouple(rawCode: string, me: Omit<Member, 'id'>) {
  return withSession(() => joinCloudCoupleNow(rawCode, me));
}

async function joinCloudCoupleNow(rawCode: string, me: Omit<Member, 'id'>) {
  const uid = await ensureSignedIn();
  const restored = await recoverCloudSession(uid);
  if (restored) return restored;
  const code = rawCode.replace(/\s|-/g, '').toUpperCase();
  return finishCloudOnboarding(uid, 'joinCouple', { code, profile: { name: me.name, color: me.color } });
}

async function finishCloudOnboarding(uid: string, name: 'createCouple' | 'joinCouple', data: object) {
  const { auth } = firebase();
  requireCurrentUser(auth, uid);
  try {
    // Le jeton peut changer pendant l’appel : le serveur vérifie aussi cette intention.
    const response = await callServer<unknown>(name, { ...data, expectedUserId: uid });
    requireCurrentUser(auth, uid);
    const coupleId = response && typeof response === 'object' && !Array.isArray(response)
      ? (response as { coupleId?: unknown }).coupleId : undefined;
    if (!validDocumentId(coupleId)) {
      throw new Error('La réponse du serveur est incomplète. Réessaie pour retrouver ton espace.');
    }
    await saveCloudSession(coupleId, uid);
    requireCurrentUser(auth, uid);
    return cloudBackend(coupleId, uid);
  } catch (error) {
    requireCurrentUser(auth, uid);
    throw error;
  }
}

export type Invitation = { code: string; expiresAt: number };
export function createCoupleInvitation(backend: Backend) {
  return backend.call<Invitation>('createInvitation', {});
}

export const AI_CONSENT_VERSION = 'anthropic-2026-10-14';
export async function hasAiConsent(backend: Backend) {
  if (backend.mode !== 'cloud') return false;
  const snap = await getDoc(doc(firebase().db, 'users', backend.userId, 'settings', 'privacy'));
  return snap.data()?.aiConsent === AI_CONSENT_VERSION;
}

/** Fusionne uniquement nos réponses privées, les statuts sans texte et les réponses révélées. */
function subscribeAnswers(coupleId: string, uid: string, cb: (items: Answer[]) => void, onError?: (error: unknown) => void) {
  const { db } = firebase();
  let own: Answer[] = [];
  let revealed: Answer[] = [];
  let statuses: { date: string; responded: string[] }[] = [];
  const ready = { own: false, revealed: false, statuses: false };
  let active = true;
  const stops: (() => void)[] = [];
  const stopAll = () => { for (const stop of stops.splice(0)) stop(); };
  const track = (stop: () => void) => { if (active) stops.push(stop); else stop(); };
  const fail = (error: unknown) => {
    if (!active) return;
    active = false;
    own = []; revealed = []; statuses = [];
    stopAll();
    if (onError) onError(error); else cb([]);
  };
  const emit = () => {
    // Un flux vide reçu est distinct d’un flux dont le premier résultat manque encore.
    if (!active || !ready.own || !ready.revealed || !ready.statuses) return;
    const merged = new Map<string, Answer>();
    for (const state of statuses) for (const from of state.responded) {
      merged.set(`${state.date}_${from}`, { id: `${state.date}_${from}`, date: state.date, from, text: '', createdAt: 0 });
    }
    for (const answer of [...revealed, ...own]) merged.set(`${answer.date}_${answer.from}`, answer);
    cb([...merged.values()]);
  };
  track(onSnapshot(collection(db, 'couples', coupleId, 'private', uid, 'answers'), (snap) => {
    if (!active) return;
    own = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Answer);
    ready.own = true;
    emit();
  }, fail));
  track(onSnapshot(collection(db, 'couples', coupleId, 'revealedAnswers'), (snap) => {
    if (!active) return;
    revealed = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Answer);
    ready.revealed = true;
    emit();
  }, fail));
  track(onSnapshot(collection(db, 'couples', coupleId, 'answerStatus'), (snap) => {
    if (!active) return;
    statuses = snap.docs.map((d) => d.data() as { date: string; responded: string[] });
    ready.statuses = true;
    emit();
  }, fail));
  return () => { active = false; stopAll(); };
}

function cloudBackend(coupleId: string, uid: string): Backend {
  const { db } = firebase();
  const coupleRef = doc(db, 'couples', coupleId);
  // Les collections privées (idées cadeaux) sont rangées sous le membre : l'autre ne peut pas les lire.
  const path = (name: CollectionName) =>
    PRIVATE_COLLECTIONS.includes(name) ? ['couples', coupleId, 'private', uid, name] : ['couples', coupleId, name];
  const col = (name: CollectionName) => {
    const [first, ...rest] = path(name);
    return collection(db, first, ...rest);
  };
  const docRef = (name: CollectionName, id: string) => {
    const [first, ...rest] = path(name);
    return doc(db, first, ...rest, id);
  };

  return {
    mode: 'cloud',
    userId: uid,
    coupleId,
    subscribeCouple: (cb, onError) =>
      onSnapshot(
        coupleRef,
        (snap) => {
          if (!snap.exists()) return cb(null);
          const data = snap.data() as CoupleDoc;
          cb({
            id: coupleId,
            since: data.since,
            photoUrl: data.photoUrl,
            photoFrame: data.photoFrame,
            members: data.members.map((id) => ({
              id,
              name: data.profiles[id]?.name ?? '…',
              color: data.profiles[id]?.color ?? '#999999',
            })),
          });
        },
        (error) => { if (onError) onError(error); else cb(null); },
      ),
    updateCouple: (patch) => updateDoc(coupleRef, clean(patch)),
    async updateMember(memberId, patch) {
      if (memberId !== uid) throw new Error('Tu peux uniquement modifier ton propre profil.');
      const fields = Object.fromEntries(
        Object.entries(clean(patch)).map(([k, v]) => [`profiles.${memberId}.${k}`, v]),
      );
      await updateDoc(coupleRef, fields);
    },
    subscribe: (name, cb, onError) => {
      if (name === 'answers') return subscribeAnswers(coupleId, uid, cb as (items: Answer[]) => void, onError);
      return onSnapshot(col(name), (snap) => cb(snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' });
        // Les anciennes données utilisent des millisecondes ; les nouvelles sont datées par Firebase.
        if (data.createdAt instanceof Timestamp) data.createdAt = data.createdAt.toMillis();
        return { ...data, id: d.id } as Collections[typeof name];
      })), (error) => { if (onError) onError(error); else cb([]); });
    },
    async add(name, data) {
      if (name === 'answers') {
        const answer = data as Omit<Answer, 'id'>;
        await callServer('submitDailyAnswer', { coupleId, date: answer.date, text: answer.text });
        return;
      }
      const payload = clean(data);
      await addDoc(col(name), 'createdAt' in payload ? { ...payload, createdAt: serverTimestamp() } : payload);
    },
    async addEvents(events) {
      if (!events.length || events.length > 52) throw new Error('Choisis entre 1 et 52 horaires.');
      const batch = writeBatch(db);
      for (const event of events) batch.set(doc(col('events')), clean(event));
      await batch.commit();
    },
    async removeEvents(ids) {
      const selected = eventRemovalIds(ids);
      if (!selected.length) return;
      const batch = writeBatch(db);
      for (const id of selected) batch.delete(docRef('events', id));
      await batch.commit();
    },
    async update(name, id, patch) {
      const { id: _ignored, ...rest } = patch as { id?: string };
      await updateDoc(docRef(name, id), clean(rest));
    },
    async remove(name, id) {
      await deleteDoc(docRef(name, id));
    },
    async uploadPhoto(localUri) {
      // Sans Firebase Storage (forfait gratuit) : photo réduite, rangée directement dans Firestore.
      if (!storageAvailable) return toCompactDataUri(localUri);
      const { storage } = firebase();
      const target = ref(storage, `couples/${coupleId}/photos/${uid}/${newId()}.jpg`);
      try {
        await uploadBytes(target, await readAsBlob(localUri), { contentType: 'image/jpeg' });
        return await getDownloadURL(target);
      } catch (e) {
        if (isStorageUnavailable(e)) {
          storageAvailable = false;
          return toCompactDataUri(localUri);
        }
        throw new PhotoUploadError();
      }
    },
    async call<T>(name: string, data: object) {
      return callServer<T>(name, { ...data, coupleId });
    },
  };
}
