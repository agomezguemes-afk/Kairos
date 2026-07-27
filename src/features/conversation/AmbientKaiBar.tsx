// KAIROS — Ambient Kai bar (Design v2, pattern 2 "barra de IA ambiental").
//
// A persistent, input-shaped affordance pinned above the tab bar on the home
// scroll. It reads as a compose field ("¿Qué te apetece hoy?") but is a
// Pressable that opens the full conversation — Kai stops being a buried button
// and becomes ambient. The gold Kai orb is THE single gold accent of the home
// screen (gold is reserved for Kai; content speaks in discipline tints, actions
// in ink). A mic glyph sits at the trailing edge as the future push-to-talk
// entry (M3) — rendered disabled for now, so the placement ships before voice.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import KaiOrb from '../onboarding/premium/KaiOrb';
import { Animation, Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';

// Floating tab capsule geometry (see components/KairosTabBar.tsx): it sits at
// insets.bottom + 16 with a 56pt height. Stack the ambient bar one Spacing.md
// above it so the two floating capsules read as a deliberate pair, never overlap.
const TAB_BAR_CLEARANCE = 16 + 56 + Spacing.md;

interface Props {
  /** Opens the full conversation surface. */
  onPress: () => void;
  /** Push-to-talk entry (M3). Absent → the mic renders disabled. */
  onMicPress?: () => void;
  label?: string;
}

function AmbientKaiBar({ onPress, onMicPress, label = '¿Qué te apetece hoy?' }: Props) {
  const insets = useSafeAreaInsets();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  }, [onPress]);

  const handleMic = useCallback(() => {
    if (!onMicPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onMicPress();
  }, [onMicPress]);

  const micEnabled = !!onMicPress;

  return (
    <Animated.View
      entering={FadeInUp.duration(Animation.duration.normal)}
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hablar con Kai"
        accessibilityHint="Abre la conversación para montar tu sesión de hoy"
        onPress={handlePress}
        style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
      >
        <View
          style={styles.orb}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          pointerEvents="none"
        >
          <KaiOrb size={26} />
        </View>
        <Text style={styles.placeholder} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hablar por voz"
          accessibilityHint={micEnabled ? 'Mantén pulsado para dictar' : 'Disponible próximamente'}
          accessibilityState={{ disabled: !micEnabled }}
          disabled={!micEnabled}
          onPress={handleMic}
          hitSlop={10}
          style={styles.mic}
        >
          <Feather
            name="mic"
            size={18}
            color={micEnabled ? Colors.ink.secondary : Colors.ink.muted}
          />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(AmbientKaiBar);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56, // ≥44pt target, matches the tab capsule height for rhythm
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    backgroundColor: Colors.paper.raised,
    borderRadius: Radius['3xl'],
    ...Shadows.elevated,
  },
  barPressed: {
    backgroundColor: Colors.bg.elevated,
  },
  // The orb wrap is oversized (halo = size*1.5); box it and clip so the halo
  // never bleeds into the placeholder text.
  orb: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    ...Type.body,
    color: Colors.ink.tertiary,
    flex: 1,
  },
  mic: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.elevated,
  },
});
