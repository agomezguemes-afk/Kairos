// KAIROS — Kai Mascot
// Animated AI avatar with speech bubble for the onboarding chat.
// The avatar is a gold circle with simple geometric eyes — easy to
// replace with a real illustration or Lottie animation later.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  FadeInUp,
} from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radius, Shadows, Animation } from '../../theme/index';

interface KaiMascotProps {
  message: string;
  /** Delay before the bubble appears (ms). */
  delay?: number;
  /** Show a typing indicator before the message. */
  showTyping?: boolean;
}

export default function KaiMascot({ message, delay = 0 }: KaiMascotProps) {
  // Subtle idle bounce on the avatar
  const avatarY = useSharedValue(0);

  useEffect(() => {
    avatarY.value = withDelay(
      delay,
      withSequence(
        withSpring(-3, { damping: 8, stiffness: 120 }),
        withSpring(0, { damping: 10, stiffness: 100 }),
      ),
    );
  }, [message]);

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: avatarY.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400).springify().damping(16)}
      style={styles.container}
    >
      {/* Avatar */}
      <Animated.View style={[styles.avatar, avatarStyle]}>
        <View style={styles.eyeRow}>
          <View style={styles.eye} />
          <View style={styles.eye} />
        </View>
        <View style={styles.mouth} />
      </Animated.View>

      {/* Speech bubble */}
      <View style={styles.bubble}>
        <View style={styles.bubbleTail} />
        <Text style={styles.bubbleText}>{message}</Text>
      </View>
    </Animated.View>
  );
}

// Small typing dots component (for future use)
export function TypingDots() {
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} />
      ))}
    </View>
  );
}

function Dot({ index }: { index: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    const animate = () => {
      opacity.value = withDelay(
        index * 200,
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.3, { duration: 300 }),
        ),
      );
    };
    animate();
    const interval = setInterval(animate, 900);
    return () => clearInterval(interval);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const AVATAR_SIZE = 44;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 48, // keep bubble from touching right edge
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    ...Shadows.card,
  },
  eyeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 3,
  },
  eye: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.text.inverse,
  },
  mouth: {
    width: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  bubble: {
    flex: 1,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    borderTopLeftRadius: Radius.xs,
    padding: Spacing.lg,
    ...Shadows.subtle,
  },
  bubbleTail: {
    position: 'absolute',
    top: 12,
    left: -6,
    width: 12,
    height: 12,
    backgroundColor: Colors.background.surface,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  bubbleText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.text.tertiary,
  },
});
