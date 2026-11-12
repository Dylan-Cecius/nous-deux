import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect, type EffectCallback } from 'react';

import type { Backend } from '../backend';
import { useSubscription } from '../subscription';

let mockBackend: Backend | null;
jest.mock('../couple-context', () => ({ useCouple: () => ({ backend: mockBackend }) }));
jest.mock('../billing', () => ({ billingEnabled: true, nativeBillingAvailable: true, FREE_SUBSCRIPTION: { active: false, expiresAt: null, owner: null } }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: EffectCallback) => {
  const react = jest.requireActual('react') as typeof import('react');
  react.useEffect(callback, [callback]);
} }));

let root: ReactTestRenderer;
let status: ReturnType<typeof useSubscription>;
function Consumer() {
  const value = useSubscription();
  useEffect(() => { status = value; });
  return null;
}
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-11-12T12:00:00Z')); });
afterEach(async () => { if (root) await act(async () => root.unmount()); jest.useRealTimers(); });

test('verified access expires while the screen stays open, even when rechecking is delayed', async () => {
  const expiry = Date.now() + 1000;
  const call = jest.fn().mockResolvedValueOnce({ active: true, expiresAt: expiry, owner: 'self' })
    .mockImplementation(() => new Promise(() => {}));
  mockBackend = { mode: 'cloud', call } as unknown as Backend;
  await act(async () => { root = create(<Consumer />); });
  expect(status.active).toBe(true);
  await act(async () => { jest.advanceTimersByTime(1100); });
  expect(call).toHaveBeenCalledTimes(2);
  expect(status.active).toBe(false);
});

test('a response for a previous account cannot unlock the current session', async () => {
  let finish!: (value: unknown) => void;
  mockBackend = { mode: 'cloud', call: jest.fn(() => new Promise((resolve) => { finish = resolve; })) } as unknown as Backend;
  await act(async () => { root = create(<Consumer />); });
  mockBackend = { mode: 'local' } as Backend;
  await act(async () => { root.update(<Consumer />); });
  await act(async () => { finish({ active: true, expiresAt: null, owner: 'self' }); });
  expect(status.active).toBe(false);
  expect(status.available).toBe(false);
});

test('provider failure closes paid access and remains retryable', async () => {
  const call = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ active: true, expiresAt: null, owner: 'partner' });
  mockBackend = { mode: 'cloud', call } as unknown as Backend;
  await act(async () => { root = create(<Consumer />); });
  expect(status.active).toBe(false);
  expect(status.error).toContain('Impossible de vérifier');
  await act(async () => { await status.refresh(); });
  expect(status.active).toBe(true);
  expect(status.owner).toBe('partner');
  expect(status.error).toBeNull();
});
