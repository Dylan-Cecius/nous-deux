import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAddMemory } from '@/components/home/memories-strip';
import { showDialog } from '@/components/dialog';
import { useSession } from '../couple-context';
import { pickPhoto } from '../photos';
import { success } from '../haptics';

jest.mock('../couple-context', () => ({ useSession: jest.fn() }));
jest.mock('../photos', () => ({ pickPhoto: jest.fn() }));
jest.mock('../haptics', () => ({ success: jest.fn() }));
jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/components/ui', () => ({}));
jest.mock('@/constants/theme', () => ({}));
jest.mock('expo-image', () => ({}));
jest.mock('expo-router', () => ({}));

let root: ReactTestRenderer;
let action!: ReturnType<typeof useAddMemory>;
const backend = { userId: 'alice', coupleId: 'old', uploadPhoto: jest.fn(), add: jest.fn() };
const nextBackend = { userId: 'bob', coupleId: 'new', uploadPhoto: jest.fn(), add: jest.fn() };
function Consumer() {
  const current = useAddMemory();
  useEffect(() => { action = current; });
  return null;
}
beforeEach(async () => {
  (useSession as jest.Mock).mockReturnValue({ backend });
  (pickPhoto as jest.Mock).mockResolvedValue({ uri: 'fictitious://picked' });
  for (const b of [backend, nextBackend]) { b.uploadPhoto.mockResolvedValue('fictitious://saved'); b.add.mockResolvedValue(undefined); }
  await act(async () => { root = create(<Consumer />); });
});
afterEach(async () => { await act(async () => { root.unmount(); }); jest.resetAllMocks(); });
const leave = async (change: string) => {
  await act(async () => {
    if (change === 'unmount') root.unmount();
    else { (useSession as jest.Mock).mockReturnValue({ backend: nextBackend }); root.update(<Consumer />); }
  });
};

test.each(['unmount', 'backend'])('un sélecteur retardé ne lance plus un upload après %s', async (change) => {
  let finish!: (value: unknown) => void;
  (pickPhoto as jest.Mock).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = action.add(); });
  await leave(change);
  await act(async () => { finish({ uri: 'fictitious://old' }); await pending; });
  expect(backend.uploadPhoto).not.toHaveBeenCalled();
  expect(nextBackend.uploadPhoto).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
});

test.each(['unmount', 'backend'])('un upload terminé après %s ne crée plus de souvenir dans l’ancien contexte', async (change) => {
  let finish!: (value: string) => void;
  backend.uploadPhoto.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = action.add(); });
  await leave(change);
  await act(async () => { finish('fictitious://old'); await pending; });
  expect(backend.add).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
});

test.each(['success', 'failure'])('le retour %s d’une ancienne écriture ne touche pas le nouvel écran', async (result) => {
  let resolve!: () => void; let reject!: (error: Error) => void;
  backend.add.mockReturnValue(new Promise<void>((yes, no) => { resolve = yes; reject = no; }));
  let pending!: Promise<void>;
  await act(async () => { pending = action.add(); });
  await leave('backend');
  const newBusyBefore = action.busy;
  await act(async () => { if (result === 'success') resolve(); else reject(new Error('Ancien envoi')); await pending; });
  expect(newBusyBefore).toBe(false);
  expect(success).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
  await act(async () => { await action.add(); });
  expect(nextBackend.add).toHaveBeenCalledTimes(1);
});

test('un ancien gestionnaire ne rouvre pas la galerie après démontage', async () => {
  const add = action.add;
  await leave('unmount');
  await act(async () => { await add(); });
  expect(pickPhoto).not.toHaveBeenCalled();
});

test('un ancien gestionnaire ne lance pas de travail sur le nouvel espace', async () => {
  const oldAdd = action.add;
  await leave('backend');
  await act(async () => { await oldAdd(); });
  expect(pickPhoto).not.toHaveBeenCalled();
});

test('la fin d’un ancien envoi ne libère pas le verrou du nouvel envoi', async () => {
  let finishOld!: (value: string) => void;
  let finishNew!: (value: string) => void;
  backend.uploadPhoto.mockReturnValue(new Promise((resolve) => { finishOld = resolve; }));
  nextBackend.uploadPhoto.mockReturnValue(new Promise((resolve) => { finishNew = resolve; }));
  let oldPending!: Promise<void>; let newPending!: Promise<void>;
  await act(async () => { oldPending = action.add(); });
  await leave('backend');
  await act(async () => { newPending = action.add(); });
  await act(async () => { finishOld('fictitious://old'); await oldPending; });
  expect(action.busy).toBe(true);
  await act(async () => { await action.add(); });
  expect(pickPhoto).toHaveBeenCalledTimes(2);
  await act(async () => { finishNew('fictitious://new'); await newPending; });
  expect(backend.add).not.toHaveBeenCalled();
  expect(nextBackend.add).toHaveBeenCalledTimes(1);
  expect(action.busy).toBe(false);
});

test('deux demandes simultanées gardent un seul sélecteur et un seul souvenir', async () => {
  await act(async () => { await Promise.all([action.add(), action.add()]); });
  expect(pickPhoto).toHaveBeenCalledTimes(1);
  expect(backend.uploadPhoto).toHaveBeenCalledTimes(1);
  expect(backend.add).toHaveBeenCalledWith('memories', expect.objectContaining({ photoUrl: 'fictitious://saved', createdBy: 'alice' }));
  expect(backend.add).toHaveBeenCalledTimes(1);
  expect(success).toHaveBeenCalledTimes(1);
  expect(action.busy).toBe(false);
});

test('annuler le sélecteur ne fait aucune écriture', async () => {
  (pickPhoto as jest.Mock).mockResolvedValue(null);
  await act(async () => { await action.add(); });
  expect(backend.uploadPhoto).not.toHaveBeenCalled();
  expect(backend.add).not.toHaveBeenCalled();
  expect(action.busy).toBe(false);
});

test('un échec courant est visible et le verrou permet de réessayer', async () => {
  backend.uploadPhoto.mockRejectedValueOnce(new Error('Envoi fictif refusé'));
  await act(async () => { await action.add(); });
  expect(showDialog).toHaveBeenCalledWith('Photo non enregistrée', 'Envoi fictif refusé');
  expect(backend.add).not.toHaveBeenCalled();
  await act(async () => { await action.add(); });
  expect(backend.add).toHaveBeenCalledTimes(1);
});
