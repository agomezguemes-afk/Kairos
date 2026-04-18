// KAIROS — AI Avatar (Kai)
// Animated mascot: blink, nod, idle float, thinking dots, celebrate.

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withRepeat,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors, Shadows } from '../theme/index';

// ======================== TYPES ========================

export type AvatarMood = 'idle' | 'listening' | 'thinking' | 'celebrating';

interface AIAvatarProps {
  size?: number;
  mood?: AvatarMood;
  /** Increment to trigger a nod. */
  nodTrigger?: number;
}

// ======================== TYPING DOTS ========================

function TypingDot({ delay }: { delay: number }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(
      withDelay(
        delay,
        withSequence(
          withTiming(-5, { duration: 280 }),
          withTiming(0,  { duration: 280 }),
        ),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(y);
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return <Animated.View style={[styles.typingDot, style]} />;
}

// ======================== MAIN AVATAR ========================

export default function AIAvatar({
  size = 48,
  mood = 'idle',
  nodTrigger = 0,
}: AIAvatarProps) {
  const eyeScaleY   = useSharedValue(1);
  const headRotate  = useSharedValue(0);
  const headScale   = useSharedValue(1);
  const headY       = useSharedValue(0); // idle float offset
  const mouthWidth  = useSharedValue(10);
  const glowOpacity = useSharedValue(0);

  // ── Blink every ~4 s ──────────────────────────────────────────
  useEffect(() => {
    const blink = () => {
      eyeScaleY.value = withSequence(
        withTiming(0.08, { duration: 70 }),
        withTiming(1,    { duration: 110 }),
      );
    };
    const id = setInterval(blink, 4000 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  // ── Nod when triggered ────────────────────────────────────────
  useEffect(() => {
    if (nodTrigger > 0) {
      headRotate.value = withSequence(
        withSpring(-4, { damping: 8,  stiffness: 200 }),
        withSpring( 2, { damping: 10, stiffness: 180 }),
        withSpring( 0, { damping: 12, stiffness: 160 }),
      );
    }
  }, [nodTrigger]);

  // ── Mood ──────────────────────────────────────────────────────
  useEffect(() => {
    cancelAnimation(headScale);
    cancelAnimation(headY);
    cancelAnimation(glowOpacity);

    switch (mood) {
      case 'idle':
        // Gentle floating bob
        headY.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 1400 }),
            withTiming( 0, { duration: 1400 }),
          ),
          -1,
          true,
        );
        mouthWidth.value  = withTiming(10, { duration: 200 });
        headScale.value   = withTiming(1,  { duration: 300 });
        glowOpacity.value = withTiming(0,  { duration: 300 });
        // Subtle pulsing glow while idle
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.12, { duration: 1800 }),
            withTiming(0.04, { duration: 1800 }),
          ),
          -1,
          true,
        );
        break;

      case 'thinking':
        // Stop floating, pulse scale
        headY.value = withTiming(0, { duration: 200 });
        headScale.value = withRepeat(
          withSequence(
            withTiming(1.04, { duration: 550 }),
            withTiming(0.96, { duration: 550 }),
          ),
          -1,
          true,
        );
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.45, { duration: 500 }),
            withTiming(0.10, { duration: 500 }),
          ),
          -1,
          true,
        );
        break;

      case 'celebrating':
        headY.value   = withTiming(0,  { duration: 150 });
        mouthWidth.value  = withSpring(15, { damping: 8 });
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.65, { duration: 350 }),
            withTiming(0.20, { duration: 350 }),
          ),
          4,
          true,
        );
        headScale.value = withSequence(
          withSpring(1.18, { damping: 6, stiffness: 220 }),
          withSpring(1,    { damping: 10, stiffness: 160 }),
        );
        break;

      case 'listening':
        headY.value       = withTiming(0,  { duration: 200 });
        mouthWidth.value  = withTiming(8,  { duration: 200 });
        headScale.value   = withTiming(1,  { duration: 200 });
        glowOpacity.value = withTiming(0.08, { duration: 200 });
        break;
    }
  }, [mood]);

  // ── Animated styles ───────────────────────────────────────────

  const headStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${headRotate.value}deg` },
      { scale:   headScale.value },
      { translateY: headY.value },
    ],
  }));

  const leftEyeStyle  = useAnimatedStyle(() => ({ transform: [{ scaleY: eyeScaleY.value }] }));
  const rightEyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: eyeScaleY.value }] }));
  const mouthStyle    = useAnimatedStyle(() => ({ width: mouthWidth.value }));
  const glowStyle     = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  // ── Sizing ────────────────────────────────────────────────────
  const eyeSize  = Math.max(4, size * 0.11);
  const eyeGap   = size * 0.18;
  const mouthH   = Math.max(3, size * 0.065);
  const borderR  = size / 2;

  const isThinking = mood === 'thinking';

  return (
    <View style={{ width: size, height: size + 6 /* room for float */ }}>
      {/* Glow ring */}
      <Animated.View
        style={[
          styles.glow,
          glowStyle,
          {
            width:  size + 10,
            height: size + 10,
            borderRadius: (size + 10) / 2,
            top:  -5,
            left: -5,
          },
        ]}
      />

      {/* Head */}
      <Animated.View
        style={[
          styles.head,
          headStyle,
          { width: size, height: size, borderRadius: borderR },
        ]}
      >
        {isThinking ? (
          // Typing indicator — three bouncing gold dots
          <View style={styles.typingRow}>
            <TypingDot delay={0} />
            <TypingDot delay={160} />
            <TypingDot delay={320} />
          </View>
        ) : (
          <>
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
                  height:                   mouthH,
                  borderRadius:             mouthH / 2,
                  borderBottomLeftRadius:   mouthH,
                  borderBottomRightRadius:  mouthH,
                },
              ]}
            />
          </>
        )}
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
    backgroundColor: Colors.accent.glow,
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
  typingRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-end',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
});
