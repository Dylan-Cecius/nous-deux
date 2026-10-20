import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { showDialog } from '@/components/dialog';
import type { Backend } from '../backend';
import { useOnboardingAction } from '../use-onboarding-action';

jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
let root: ReactTestRenderer;
let action: ReturnType<typeof useOnboardingAction>;
const setBackend = jest.fn();
const backend = { mode: 'local', coupleId: 'fictitious', userId: 'alice' } as Backend;
function Harness({ install = setBackend }: { install?: (backend: Backend) => void }) {
  const current = useOnboardingAction(install);
  useEffect(() => { action = current; }, [current]);
  return null;
}
beforeEach(async () => { await act(async () => { root = create(<Harness />); }); });
afterEach(async () => { await act(async () => root.unmount()); jest.clearAllMocks(); });

test('deux demandes rapprochées n’exécutent que la première action', async () => {
  let finish!: (backend: Backend) => void;
  const first = jest.fn(() => new Promise<Backend>(resolve => { finish = resolve; }));
  const second = jest.fn().mockResolvedValue(backend);
  let pending!: Promise<unknown>;
  await act(async () => { pending = action.run(first); await action.run(second); });
  const busy = action.busy;
  await act(async () => { finish(backend); await pending; });
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
  expect(busy).toBe(true);
  expect(action.busy).toBe(false);
  expect(setBackend).toHaveBeenCalledTimes(1);
});

test.each(['success', 'failure'])('un résultat %s après sortie n’installe rien et ne montre pas d’erreur', async outcome => {
  let finish!: () => void;
  const request = () => new Promise<Backend>((resolve, reject) => {
    finish = () => outcome === 'success' ? resolve(backend) : reject(new Error('Ancienne demande fictive'));
  });
  let pending!: Promise<unknown>;
  await act(async () => { pending = action.run(request); });
  await act(async () => root.unmount());
  await act(async () => { finish(); await pending; });
  expect(setBackend).not.toHaveBeenCalled();
  expect(showDialog).not.toHaveBeenCalled();
});

test('une action conservée après sortie ne démarre aucune demande', async () => {
  const run = action.run;
  const request = jest.fn().mockResolvedValue(backend);
  await act(async () => root.unmount());
  await act(async () => { await run(request); });
  expect(request).not.toHaveBeenCalled();
});

test('un échec courant permet une nouvelle demande volontaire', async () => {
  const request = jest.fn().mockRejectedValueOnce(new Error('Échec fictif')).mockResolvedValueOnce(backend);
  await act(async () => { await action.run(request); });
  expect(showDialog).toHaveBeenCalledWith('Oups', 'Échec fictif');
  expect(action.busy).toBe(false);
  await act(async () => { await action.run(request); });
  expect(request).toHaveBeenCalledTimes(2);
  expect(setBackend).toHaveBeenCalledWith(backend);
});

test.each([false, true])('une interaction est bloquée pendant la demande (rendu : %s)', async rendered => {
  const interact = action.interact;
  const change = jest.fn();
  let finish!: (backend: Backend) => void;
  const request = () => new Promise<Backend>(resolve => { finish = resolve; });
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = action.run(request);
    if (!rendered) interact(change);
  });
  if (rendered) await act(async () => interact(change));
  await act(async () => { finish(backend); await pending; });
  expect(change).not.toHaveBeenCalled();
  await act(async () => action.interact(change));
  expect(change).toHaveBeenCalledTimes(1);
});

test('une interaction conservée après démontage est ignorée', async () => {
  const interact = action.interact;
  const change = jest.fn();
  await act(async () => root.unmount());
  await act(async () => interact(change));
  expect(change).not.toHaveBeenCalled();
});

test('les interactions ordinaires se composent sans rendre le formulaire occupé', async () => {
  const change = jest.fn();
  await act(async () => { action.interact(change); action.interact(change); });
  expect(change).toHaveBeenCalledTimes(2);
  expect(action.busy).toBe(false);
});
