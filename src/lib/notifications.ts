import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, daysBetween, fromKey, nextOccurrence, todayKey } from './dates';
import type { SpecialDate } from './types';

const supported = Platform.OS !== 'web';
export const pushSupported = supported && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
let remindersGeneration = 0;
let remindersCleanup: Promise<void> = Promise.resolve();

export async function clearReminders() {
  remindersGeneration++;
  if (supported) {
    const cleanup = remindersCleanup.then(async () => {
      // Les deux nettoyages sont indépendants : tenter le retrait des notifications
      // déjà affichées même si l'annulation des rappels échoue. Attendre les deux
      // avant de libérer la file, même quand le premier résultat est un échec.
      const results = await Promise.allSettled([
        Notifications.cancelAllScheduledNotificationsAsync(),
        Notifications.dismissAllNotificationsAsync(),
      ]);
      const failure = results.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    });
    // Une erreur reste transmise à l'appelant, sans empoisonner la file des
    // prochaines tentatives. Les créations attendent la fin du nettoyage natif.
    remindersCleanup = cleanup.catch(() => {});
    await cleanup;
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
  // Aucun dialogue de permission au lancement : l'utilisateur active les notifications dans Nous.
  if (!pushSupported || !(await Notifications.getPermissionsAsync()).granted) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

/** Reprogramme les rappels locaux et renvoie true uniquement si cette demande a terminé. */
export async function scheduleCountdownReminders(dates: SpecialDate[], isActive: () => boolean = () => true): Promise<boolean> {
  // Une ancienne commande ne doit pas invalider la génération du contexte courant.
  if (!supported || !isActive()) return false;
  const generation = ++remindersGeneration;
  const isCurrent = () => generation === remindersGeneration && isActive();
  const granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted || !isCurrent()) return false;
  await remindersCleanup;
  if (!isCurrent()) return false;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  // Les lectures natives peuvent terminer après une programmation plus récente.
  // Ne jamais annuler ses rappels à partir d'une demande devenue obsolète.
  if (!isCurrent()) return false;
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === 'countdown')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const created: string[] = [];
  try {
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
        if (!isCurrent()) return false;
        const identifier = await Notifications.scheduleNotificationAsync({
          content: { title: 'Nous Deux', body, data: { kind: 'countdown' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
        created.push(identifier);
        if (!isCurrent()) return false;
      }
    }
    return isCurrent();
  } finally {
    // Nettoyer uniquement les identifiants confirmés de cette demande, jamais ceux
    // d'une autre génération. Un appel natif déjà lancé n'est pas annulable à la source.
    if (!isCurrent()) {
      await Promise.all(created.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    }
  }
}
