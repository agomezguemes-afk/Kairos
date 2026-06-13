// KAIROS — GoldButton: the primary action.
//
// Pro, not PowerPoint. A confident full-width gold pill: a restrained 2-stop
// fill (a whisper lighter at the top), a thin top gloss for a "lit from above"
// sheen, and a TIGHT contact shadow that grounds it on the surface — never a
// floaty blurred glow. Physical press via spring. Optional hint line beneath.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Type } from '../../../theme/tokens';
import { usePressSpring } from './motion/usePressSpring';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface GoldButtonProps {
  label: string;
  onPress: () => void;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

// Restrained vertical gold — top a touch brighter (#D6B575), base a touch deeper
// (#C19D5C). Centered on the brand gold (#C9A96E) so it reads as one rich gold,
// not a metal bevel.

function GoldButton({ label, onPress, hint, style }: GoldButtonProps) {
  const { pressValue, onPressIn, onPressOut } = usePressSpring({ to: 0.975 });

  // Press = a physical sink: it scales down AND its contact shadow tightens, so
  // the pill presses into the surface instead of just shrinking.
  const animatedStyle = useAnimatedStyle(() => {
    const p = pressValue.value;
    return {
      transform: [{ scale: 1 - p * 0.025 }],
      shadowOpacity: 0.2 - p * 0.13,
      shadowRadius: 5 - p * 2.5,
      shadowOffset: { width: 0, height: 3 - p * 1.8 },
    };
  });

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
        style={[styles.button, animatedStyle]}
      >
        <LinearGradient
          colors={['#D6B575', '#C19D5C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fill}
        >
          {/* Thin top gloss — the premium "lit from above" sheen. */}
          <LinearGradient
            colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
            style={styles.gloss}
            pointerEvents="none"
          />
          <Text style={styles.text}>{label}</Text>
        </LinearGradient>
      </AnimatedPressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 8 },
  button: {
    width: '100%',
    borderRadius: Radius.pill,
    backgroundColor: '#C19D5C',
    // Tight contact shadow — grounds the pill without floating it.
    shadowColor: '#6E541C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  fill: {
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 27,
    borderTopLeftRadius: Radius.pill,
    borderTopRightRadius: Radius.pill,
  },
  text: { ...Type.subheading, color: Colors.ink.inverse, letterSpacing: 0.2 },
  hint: { ...Type.caption, color: Colors.ink.muted },
});

export default React.memo(GoldButton);
