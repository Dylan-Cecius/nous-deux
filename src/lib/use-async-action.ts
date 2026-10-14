import { useEffect, useRef, useState } from 'react';

import { showDialog } from '@/components/dialog';
import { userError } from './errors';

/** Empêche deux envois simultanés et rend les échecs visibles sans perdre le formulaire. */
export function useAsyncAction<Args extends unknown[]>(action: (...args: Args) => unknown) {
  const locked = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async (...args: Args) => {
    if (locked.current) return;
    locked.current = true;
    try {
      const result = action(...args);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        if (mounted.current) setPending(true);
        await result;
      }
    } catch (error) {
      showDialog('Action impossible', userError(error));
    } finally {
      locked.current = false;
      if (mounted.current) setPending(false);
    }
  };
  return { run, pending };
}
