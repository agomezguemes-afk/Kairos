// Haptics wrapper: expo-haptics has no web implementation, and a missing
// buzz must never break an interaction.

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

function run(p: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  p().catch((e: unknown) => console.warn('[haptics]', e));
}

export const feedback = {
  tick: () => run(() => Haptics.selectionAsync()),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
