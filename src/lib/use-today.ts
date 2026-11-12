import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayKey } from './dates';

/** Le jour local reste à jour à minuit et après un retour dans l’application. */
export function useTodayKey(): string {
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      setToday(todayKey());
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 50);
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
