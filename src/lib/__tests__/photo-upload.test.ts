import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDownloadURL, uploadBytes } from 'firebase/storage';
import { loadSession, PhotoUploadError, type Backend } from '../backend';
import { toCompactDataUri } from '../photos';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../firebase', () => ({ isFirebaseConfigured: true, firebase: () => ({ db: {}, storage: {}, auth: mockAuth }) }));
jest.mock('../photos', () => ({ toCompactDataUri: jest.fn() }));
jest.mock('../notifications', () => ({ clearReminders: jest.fn() }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/functions', () => ({}));
jest.mock('firebase/storage', () => ({ ref: (_s: unknown, path: string) => path, uploadBytes: jest.fn(), getDownloadURL: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => path.join('/'), collection: jest.fn(),
  getDoc: jest.fn(async () => ({ data: () => ({ members: ['alice', 'bob'] }) })),
}));

const mockAuth: { authStateReady: () => Promise<void>; currentUser: { uid: string } | null } = { authStateReady: async () => {}, currentUser: { uid: 'alice' } };
let backend: Backend;
let onRead: (() => void) | undefined;
let xhr: jest.Mock;
const originalXhr = Object.getOwnPropertyDescriptor(globalThis, 'XMLHttpRequest');
const connect = async () => {
  await AsyncStorage.setItem('session', JSON.stringify({ mode: 'cloud', userId: 'alice', coupleId: 'couple' }));
  return (await loadSession())!;
};
beforeEach(async () => {
  jest.clearAllMocks();
  mockAuth.currentUser = { uid: 'alice' };
  onRead = undefined;
  (uploadBytes as jest.Mock).mockReset().mockResolvedValue({});
  (getDownloadURL as jest.Mock).mockReset().mockResolvedValue('https://fictitious.invalid/photo');
  (toCompactDataUri as jest.Mock).mockReset().mockResolvedValue('data:image/jpeg;base64,FAKE');
  xhr = jest.fn(() => {
    const request = { response: { size: 12 }, responseType: '', onload: () => {}, onerror: () => {}, open: jest.fn(), send: () => { onRead?.(); request.onload(); } };
    return request as unknown as XMLHttpRequest;
  });
  Object.defineProperty(globalThis, 'XMLHttpRequest', { configurable: true, writable: true, value: xhr });
  backend = await connect();
});
afterEach(() => {
  if (originalXhr) Object.defineProperty(globalThis, 'XMLHttpRequest', originalXhr);
  else Reflect.deleteProperty(globalThis, 'XMLHttpRequest');
});

test.each(['storage/unauthorized', 'storage/unknown', 'storage/unauthenticated', 'storage/retry-limit-exceeded'])('le refus %s ne devient pas un repli silencieux et la tentative suivante utilise Storage', async (code) => {
  (uploadBytes as jest.Mock).mockRejectedValueOnce({ code });
  await expect(backend.uploadPhoto('fictitious://one')).rejects.toBeInstanceOf(PhotoUploadError);
  expect(toCompactDataUri).not.toHaveBeenCalled();
  await expect(backend.uploadPhoto('fictitious://two')).resolves.toBe('https://fictitious.invalid/photo');
  expect(uploadBytes).toHaveBeenCalledTimes(2);
});

test.each(['storage/bucket-not-found', 'storage/project-not-found'])('repli %s limité au backend courant', async (code) => {
  (uploadBytes as jest.Mock).mockRejectedValueOnce({ code });
  await expect(backend.uploadPhoto('fictitious://one')).resolves.toContain('data:image/jpeg');
  await backend.uploadPhoto('fictitious://two');
  expect(uploadBytes).toHaveBeenCalledTimes(1);
  const reconnected = await connect();
  await expect(reconnected.uploadPhoto('fictitious://three')).resolves.toBe('https://fictitious.invalid/photo');
  expect(uploadBytes).toHaveBeenCalledTimes(2);
});

test.each(['before', 'read', 'upload', 'url', 'fallback'])('identité remplacée pendant %s : résultat refusé', async (stage) => {
  const change = () => { mockAuth.currentUser = { uid: 'bob' }; };
  if (stage === 'before') change();
  if (stage === 'read') onRead = change;
  if (stage === 'upload') (uploadBytes as jest.Mock).mockImplementationOnce(async () => { change(); });
  if (stage === 'url') (getDownloadURL as jest.Mock).mockImplementationOnce(async () => { change(); return 'https://fictitious.invalid/old'; });
  if (stage === 'fallback') {
    (uploadBytes as jest.Mock).mockRejectedValueOnce({ code: 'storage/bucket-not-found' });
    (toCompactDataUri as jest.Mock).mockImplementationOnce(async () => { change(); return 'data:image/jpeg;base64,FAKE'; });
  }
  await expect(backend.uploadPhoto('fictitious://one')).rejects.toThrow('compte a changé');
  if (stage === 'before') expect(xhr).not.toHaveBeenCalled();
  if (stage === 'before' || stage === 'read') expect(uploadBytes).not.toHaveBeenCalled();
  if (stage === 'upload') expect(getDownloadURL).not.toHaveBeenCalled();
});

test('une ancienne erreur ne déclenche pas de compression dans un nouveau compte', async () => {
  (uploadBytes as jest.Mock).mockImplementationOnce(async () => { mockAuth.currentUser = null; throw { code: 'storage/bucket-not-found' }; });
  await expect(backend.uploadPhoto('fictitious://one')).rejects.toThrow('compte a changé');
  expect(toCompactDataUri).not.toHaveBeenCalled();
});

test('un échec de compression reste visible et le même repli peut être retenté', async () => {
  (uploadBytes as jest.Mock).mockRejectedValueOnce({ code: 'storage/bucket-not-found' });
  (toCompactDataUri as jest.Mock).mockRejectedValueOnce(new Error('Photo trop lourde'));
  await expect(backend.uploadPhoto('fictitious://one')).rejects.toThrow('Photo trop lourde');
  await expect(backend.uploadPhoto('fictitious://two')).resolves.toContain('data:image/jpeg');
});

test.each(['storage/bucket-not-found', 'storage/project-not-found'])('après upload réussi, une erreur URL %s ne produit pas une seconde copie', async (code) => {
  (getDownloadURL as jest.Mock).mockRejectedValueOnce({ code });
  await expect(backend.uploadPhoto('fictitious://one')).rejects.toBeInstanceOf(PhotoUploadError);
  expect(toCompactDataUri).not.toHaveBeenCalled();
});
