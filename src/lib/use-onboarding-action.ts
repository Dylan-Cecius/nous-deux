import { useEffect, useMemo, useRef } from 'react';
import { showDialog } from '@/components/dialog';
import type { Backend } from './backend';
import { entryErrorMessage } from './entry-errors';
import { useAsyncAction } from './use-async-action';

/** Request state for the entry flow, independent of its decorative native assets. */
export function useOnboardingAction(setBackend: (backend: Backend) => void, context: unknown = null) {
  const scope = useMemo(() => ({ context }), [context]);
  const active = useRef<object | null>(null);
  useEffect(() => {
    active.current = scope;
    return () => { active.current = null; };
  }, [scope]);
  const { run: guarded, pending: busy } = useAsyncAction((action: () => unknown) => action());
  const run = (action: () => Promise<Backend>) => guarded(async () => {
    if (active.current !== scope) return;
    try {
      const backend = await action();
      if (active.current === scope) setBackend(backend);
    } catch (e) {
      if (active.current === scope) showDialog('Oups', entryErrorMessage(e) ?? 'L’ouverture de votre espace n’a pas pu être confirmée. Vérifie ta connexion, puis réessaie. Ta saisie est conservée.');
    }
  });
  const interact = (action: () => void) => guarded(() => { if (active.current === scope) action(); });
  const transition = (action: () => void) => guarded(() => {
    if (active.current !== scope) return;
    // The following render may be deferred: invalidate before requesting it.
    active.current = null;
    action();
  });
  return { run, busy, interact, transition };
}
