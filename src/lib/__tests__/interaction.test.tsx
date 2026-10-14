import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { showDialog } from '@/components/dialog';
import { useAsyncAction } from '../use-async-action';
import { CoupleProvider, useCouple } from '../couple-context';
import { clearSession, loadSession, type Backend } from '../backend';

jest.mock('@/components/dialog', () => ({ showDialog: jest.fn() }));
jest.mock('@/constants/theme', () => ({ BothColor: '#000000' }));
jest.mock('../backend', () => ({ loadSession: jest.fn(), clearSession: jest.fn() }));

let root: ReactTestRenderer;
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.clearAllMocks(); });

test('un double appui ne crée pas deux enregistrements pendant une requête', async () => {
  let finish!: () => void;
  const write = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  let action!: ReturnType<typeof useAsyncAction>;
  function Form() { action = useAsyncAction(write); return null; }
  await act(async () => { root = create(<Form />); });
  let pending!: Promise<void>;
  await act(async () => { pending = action.run(); void action.run(); });
  expect(write).toHaveBeenCalledTimes(1);
  expect(action.pending).toBe(true);
  await act(async () => { finish(); await pending; });
  expect(action.pending).toBe(false);
});

test('un refus serveur est visible et autorise une nouvelle tentative', async () => {
  const write = jest.fn().mockRejectedValueOnce({ code: 'permission-denied' }).mockResolvedValue(undefined);
  let action!: ReturnType<typeof useAsyncAction>;
  function Form() { action = useAsyncAction(write); return null; }
  await act(async () => { root = create(<Form />); });
  await act(async () => { await action.run(); });
  expect(showDialog).toHaveBeenCalledWith('Action impossible', expect.stringContaining('n’est pas autorisée'));
  expect(action.pending).toBe(false);
  await act(async () => { await action.run(); });
  expect(write).toHaveBeenCalledTimes(2);
});

test('une panne de restauration ne renvoie pas silencieusement vers la création de compte', async () => {
  const backend = { coupleId: 'existing', subscribeCouple: jest.fn(() => () => {}) } as unknown as Backend;
  (loadSession as jest.Mock).mockRejectedValueOnce({ code: 'unavailable' }).mockResolvedValueOnce(backend);
  let session!: ReturnType<typeof useCouple>;
  function Consumer() { session = useCouple(); return null; }
  await act(async () => { root = create(<CoupleProvider><Consumer /></CoupleProvider>); });
  expect(session.restoreError).toBe(true);
  expect(session.backend).toBeNull();
  expect(clearSession).not.toHaveBeenCalled();
  await act(async () => { await session.retrySession(); });
  expect(session.restoreError).toBe(false);
  expect(session.backend).toBe(backend);
  expect(clearSession).not.toHaveBeenCalled();
});
