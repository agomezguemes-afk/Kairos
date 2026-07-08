// KAIROS — GoldButton: the primary action.
//
// Studied against many treatments on the warm ground (see __ButtonLab). The pale
// champagne read washed-out/cheap; this is a deep, confident gold with real
// presence: a barely-there 2-stop fill for depth (NOT a glossy bevel), a 1px top
// highlight for a lit edge, a slightly-less-round radius so it reads bespoke (not
// a generic pill), and a TIGHT contact shadow — never a floaty glow. Press is a
// physical sink (scale + the shadow tightens).

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Type } from '../../../theme/tokens';
import { usePressSpring } from './motion/usePressSpring';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BTN_RADIUS = 18;

interface GoldButtonProps {
  label: string;
  onPress: () => void;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  /** While true the button is inert and shows a spinner + `loadingLabel`. */
  loading?: boolean;
  /** Copy shown next to the spinner while loading. */
  loadingLabel?: string;
}

function GoldButton({
  label,
  onPress,
  hint,
  style,
  loading = false,
  loadingLabel,
}: GoldButtonProps) {
  const { pressValue, onPressIn, onPressOut } = usePressSpring({ to: 0.975 });

  // Press = a physical sink: scales down AND its contact shadow tightens, so the
  // button presses into the surface instead of just shrinking.
  const animatedStyle = useAnimatedStyle(() => {
    const p = pressValue.value;
    return {
      transform: [{ scale: 1 - p * 0.022 }],
      shadowOpacity: 0.18 - p * 0.11,
      shadowRadius: 5 - p * 2.5,
      shadowOffset: { width: 0, height: 3 - p * 1.8 },
    };
  });

  // ...and it darkens a touch under the finger, like real material.
  const darkenStyle = useAnimatedStyle(() => ({ opacity: pressValue.value * 0.1 }));

  const handlePress = useCallback(() => {
    if (loading) return; // inert while the host resolves — no double-commit
    // The primary action earns a success notification — it feels like a commit.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onPress();
  }, [onPress, loading]);

  return (
    <View style={[styles.wrap, style]}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={loading ? (loadingLabel ?? label) : label}
        accessibilityHint={hint}
        accessibilityState={{ disabled: loading, busy: loading }}
        disabled={loading}
        onPress={handlePress}
        onPressIn={loading ? undefined : onPressIn}
        onPressOut={loading ? undefined : onPressOut}
        style={[styles.button, animatedStyle]}
      >
        <LinearGradient
          colors={['#BE9C53', '#AC8941']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fill}
        >
          {/* 1px-feel top highlight — a lit edge, not a gloss bevel. */}
          <View style={styles.highlight} />
          {/* Press darken — fills under the finger for physical feedback. */}
          <Animated.View style={[styles.darken, darkenStyle]} pointerEvents="none" />
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.ink.inverse} />
              {loadingLabel ? <Text style={styles.text}>{loadingLabel}</Text> : null}
            </View>
          ) : (
            <Text style={styles.text}>{label}</Text>
          )}
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
    borderRadius: BTN_RADIUS,
    backgroundColor: '#AC8941',
    shadowColor: '#5A451A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  fill: {
    height: 56,
    borderRadius: BTN_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: BTN_RADIUS,
    borderTopRightRadius: BTN_RADIUS,
  },
  darken: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3A2A08',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  text: { ...Type.subheading, color: Colors.ink.inverse, letterSpacing: 0.3 },
  hint: { ...Type.caption, color: Colors.ink.muted },
});

export default React.memo(GoldButton);
