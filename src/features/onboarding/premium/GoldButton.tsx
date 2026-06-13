// KAIROS — GoldButton: the primary action, with depth.
//
// A flat gold pill reads cheap; a subtle vertical metallic gradient + a soft
// gold-tinted glow shadow makes it feel tactile and premium (the depth seen in
// best-in-class apps) while staying on-brand. Optional hint line beneath.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Shadows, Type } from '../../../theme/tokens';
import { usePressSpring } from './motion/usePressSpring';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface GoldButtonProps {
  label: string;
  onPress: () => void;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

// Soft top-lit metallic sheen: a crisp highlight at the very top, base through
// the middle, a warm (not olive) deep gold at the bottom. Reads as one gold
// with dimension, not a flat fill.
const SHEEN = ['#EAD3A0', '#CFAC6E', Colors.gold.base, '#B68C49'] as const;
const SHEEN_LOCATIONS = [0, 0.18, 0.6, 1] as const;

function GoldButton({ label, onPress, hint, style }: GoldButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressSpring({ to: 0.97 });

  const handlePress = useCallback(() => {
    // The primary action earns a success notification — it feels like a commit.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <View style={[styles.wrap, style]}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.shadow, animatedStyle]}
      >
        <LinearGradient
          colors={SHEEN}
          locations={SHEEN_LOCATIONS}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.cta}
        >
          <Text style={styles.text}>{label}</Text>
        </LinearGradient>
      </AnimatedPressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 8 },
  shadow: {
    width: '88%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.gold.base, // backing so the glow shadow has a shape
    ...Shadows.cardWarm,
  },
  cta: {
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: { ...Type.subheading, color: Colors.ink.inverse },
  hint: { ...Type.caption, color: Colors.ink.muted },
});

export default React.memo(GoldButton);
