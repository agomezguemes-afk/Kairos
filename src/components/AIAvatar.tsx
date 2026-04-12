// KAIROS — AI Avatar (Kai)
// Animated mascot with blink, nod, and celebrate animations.
// Gold circle with geometric eyes — upgradeable to Lottie/SVG later.

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withRepeat,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors, Shadows } from '../theme/index';

// ======================== TYPES ========================

export type AvatarMood = 'idle' | 'listening' | 'thinking' | 'celebrating';

interface AIAvatarProps {
  size?: number;
  mood?: AvatarMood;
  /** Trigger a nod animation (increment to trigger). */
  nodTrigger?: number;
}

// ======================== COMPONENT ========================

export default function AIAvatar({
  size = 48,
  mood = 'idle',
  nodTrigger = 0,
}: AIAvatarProps) {
  const eyeScaleY = useSharedValue(1);
  const headRotate = useSharedValue(0);
  const headScale = useSharedValue(1);
  const mouthWidth = useSharedValue(10);
  const glowOpacity = useSharedValue(0);

  // ---- Blink every ~4 seconds ----
  useEffect(() => {
    const blink = () => {
      eyeScaleY.value = withSequence(
        withTiming(0.1, { duration: 80 }),
        withTiming(1, { duration: 120 }),
      );
    };

    const interval = setInterval(blink, 4000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  // ---- Nod when triggered ----
  useEffect(() => {
    if (nodTrigger > 0) {
      headRotate.value = withSequence(
        withSpring(-4, { damping: 8, stiffness: 200 }),
        withSpring(2, { damping: 10, stiffness: 180 }),
        withSpring(0, { damping: 12, stiffness: 160 }),
      );
    }
  }, [nodTrigger]);

  // ---- Mood changes ----
  useEffect(() => {
    switch (mood) {
      case 'thinking':
        // Subtle pulse
        headScale.value = withRepeat(
          withSequence(
            withTiming(1.03, { duration: 600 }),
            withTiming(0.97, { duration: 600 }),
          ),
          -1,
          true,
        );
        break;

      case 'celebrating':
        // Big smile + glow
        mouthWidth.value = withSpring(14, { damping: 8 });
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 400 }),
            withTiming(0.2, { duration: 400 }),
          ),
          3,
          true,
        );
        headScale.value = withSequence(
          withSpring(1.15, { damping: 6, stiffness: 200 }),
          withSpring(1, { damping: 10, stiffness: 150 }),
        );
        break;

      case 'listening':
        mouthWidth.value = withTiming(8, { duration: 200 });
        headScale.value = withTiming(1, { duration: 200 });
        break;

      default: // idle
        cancelAnimation(headScale);
        headScale.value = withTiming(1, { duration: 300 });
        mouthWidth.value = withTiming(10, { duration: 200 });
        glowOpacity.value = withTiming(0, { duration: 300 });
        break;
    }
  }, [mood]);

  // ---- Animated styles ----
  const headStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${headRotate.value}deg` },
      { scale: headScale.value },
    ],
  }));

  const leftEyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeScaleY.value }],
  }));

  const rightEyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeScaleY.value }],
  }));

  const mouthStyle = useAnimatedStyle(() => ({
    width: mouthWidth.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ---- Sizing ----
  const eyeSize = Math.max(4, size * 0.11);
  const eyeGap = size * 0.18;
  const mouthH = Math.max(3, size * 0.065);
  const borderR = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* Glow ring (celebrate) */}
      <Animated.View
        style={[
          styles.glow,
          glowStyle,
          {
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            top: -4,
            left: -4,
          },
        ]}
      />

      {/* Head */}
      <Animated.View
        style={[
          styles.head,
          headStyle,
          {
            width: size,
            height: size,
            borderRadius: borderR,
          },
        ]}
      >
        {/* Eyes */}
        <View style={[styles.eyeRow, { gap: eyeGap, marginBottom: size * 0.06 }]}>
          <Animated.View
            style={[
              styles.eye,
              leftEyeStyle,
              { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 },
            ]}
          />
          <Animated.View
            style={[
              styles.eye,
              rightEyeStyle,
              { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 },
            ]}
          />
        </View>

        {/* Mouth */}
        <Animated.View
          style={[
            styles.mouth,
            mouthStyle,
            {
              height: mouthH,
              borderRadius: mouthH / 2,
              borderBottomLeftRadius: mouthH,
              borderBottomRightRadius: mouthH,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  head: {
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  glow: {
    position: 'absolute',
    backgroundColor: Colors.accent.light,
  },
  eyeRow: {
    flexDirection: 'row',
  },
  eye: {
    backgroundColor: Colors.text.inverse,
  },
  mouth: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});
