import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Petites vibrations de retour. Silencieuses sur le web et si l'appareil ne les gère pas.
const safe = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
};

export const tap = () => safe(() => Haptics.selectionAsync());
export const bump = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const success = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
