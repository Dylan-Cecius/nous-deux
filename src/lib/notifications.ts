import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, daysBetween, fromKey, nextOccurrence, todayKey } from './dates';
import type { SpecialDate } from './types';

const supported = Platform.OS !== 'web';
let remindersGeneration = 0;

export async function clearReminders() {
  remindersGeneration++;
  if (supported) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  }
}

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Demande l'autorisation d'afficher des notifications. Renvoie true si elle est accordée. */
export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Nous Deux',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Jeton qui permet à ta moitié de t'envoyer des notifications push.
 * Nécessite un projet EAS (`eas init`) et une vraie app (pas Expo Go sur Android) : renvoie null sinon.
 */
export async function getPushToken(): Promise<string | null> {
  if (!supported || !(await ensurePermission())) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

/** Reprogramme les rappels locaux « J-1 » et « Jour J » (à 9h) pour les comptes à rebours. */
export async function scheduleCountdownReminders(dates: SpecialDate[]) {
  const generation = ++remindersGeneration;
  if (!supported) return;
  const granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === 'countdown')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const today = todayKey();
  for (const d of dates) {
    const next = nextOccurrence(d.date, d.yearly);
    if (daysBetween(today, next) < 0) continue;
    const reminders: [string, string][] = [
      [addDays(next, -1), `Demain : ${d.title}`],
      [next, `C’est aujourd’hui : ${d.title} 🎉`],
    ];
    for (const [day, body] of reminders) {
      const at = fromKey(day);
      at.setHours(9, 0, 0, 0);
      if (at.getTime() <= Date.now()) continue;
      if (generation !== remindersGeneration) return;
      const identifier = await Notifications.scheduleNotificationAsync({
        content: { title: 'Nous Deux', body, data: { kind: 'countdown' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
      if (generation !== remindersGeneration) await Notifications.cancelScheduledNotificationAsync(identifier);
    }
  }
}
