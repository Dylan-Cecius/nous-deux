import { useEffect, useRef } from 'react';
import { showDialog } from '@/components/dialog';
import type { Backend } from './backend';
import { useAsyncAction } from './use-async-action';

/** Request state for the entry flow, independent of its decorative native assets. */
export function useOnboardingAction(setBackend: (backend: Backend) => void) {
  const active = useRef<object | null>(null);
  useEffect(() => {
    active.current = {};
    return () => { active.current = null; };
  }, []);
  const { run: guarded, pending: busy } = useAsyncAction((action: () => unknown) => action());
  const run = (action: () => Promise<Backend>) => guarded(async () => {
    const scope = active.current;
    if (!scope) return;
    try {
      const backend = await action();
      if (active.current === scope) setBackend(backend);
    } catch (e) {
      if (active.current === scope) showDialog('Oups', e instanceof Error ? e.message : String(e));
    }
  });
  const interact = (action: () => void) => guarded(() => { if (active.current) action(); });
  return { run, busy, interact };
}
