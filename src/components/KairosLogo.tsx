// KAIROS — Logo Mark Component
// Rounded-square gold gradient container, SVG K drawn with animated strokes,
// followed by a diagonal shimmer sweep.
//
// Usage:
//   <KairosLogo size={80} />                   ← static, no animation
//   <KairosLogo size={80} animate delay={200} onReady={cb} />  ← draw-on

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated as RNAnimated } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme';

// Animated wrappers for SVG elements (useNativeDriver: false for SVG props)
const AnimatedLine = RNAnimated.createAnimatedComponent(Line);

// ── K geometry (100 × 100 view-box) ─────────────────────────────────────────
// Vertical bar : (30, 12) → (30, 88)   length = 76
// Upper arm    : (30, 50) → (70, 12)   length ≈ √(40²+38²) ≈ 55
// Lower arm    : (30, 50) → (70, 88)   length ≈ √(40²+38²) ≈ 55
const VBAR = 76;
const ARM  = Math.round(Math.sqrt(40 ** 2 + 38 ** 2)); // 55

export interface KairosLogoProps {
  size?: number;
  /** Plays the draw-on animation when true. Static when false (default). */
  animate?: boolean;
  /** ms before the animation starts */
  delay?: number;
  /** called when animation completes (or immediately if animate=false) */
  onReady?: () => void;
}

export default function KairosLogo({
  size = 72,
  animate = false,
  delay = 0,
  onReady,
}: KairosLogoProps) {
  // SVG stroke dash-offset values (0 = fully drawn)
  const vbar  = useRef(new RNAnimated.Value(animate ? VBAR : 0)).current;
  const upper = useRef(new RNAnimated.Value(animate ? ARM  : 0)).current;
  const lower = useRef(new RNAnimated.Value(animate ? ARM  : 0)).current;

  // Shimmer sweep
  const shimX  = useRef(new RNAnimated.Value(-size)).current;
  const shimOp = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      onReady?.();
      return;
    }

    RNAnimated.sequence([
      RNAnimated.delay(delay),

      // 1 — vertical bar draws downward
      RNAnimated.timing(vbar, {
        toValue: 0,
        duration: 420,
        useNativeDriver: false,
      }),

      // 2 — arms extend from centre, slightly staggered
      RNAnimated.parallel([
        RNAnimated.timing(upper, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
        RNAnimated.sequence([
          RNAnimated.delay(55),
          RNAnimated.timing(lower, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
        ]),
      ]),

      // 3 — shimmer sweep across the mark
      RNAnimated.parallel([
        RNAnimated.timing(shimOp, {
          toValue: 1,
          duration: 60,
          useNativeDriver: false,
        }),
        RNAnimated.timing(shimX, {
          toValue: size * 1.6,
          duration: 380,
          useNativeDriver: false,
        }),
      ]),
      RNAnimated.timing(shimOp, {
        toValue: 0,
        duration: 100,
        useNativeDriver: false,
      }),
    ]).start(() => onReady?.());
  }, []);

  const borderRadius = Math.round(size * 0.235); // ≈ iOS app icon ratio

  return (
    <View
      style={[
        styles.shadow,
        {
          width: size,
          height: size,
          borderRadius,
          shadowOffset: { width: 0, height: Math.round(size * 0.1) },
          shadowRadius: Math.round(size * 0.28),
        },
      ]}
    >
      {/* Gold gradient background */}
      <LinearGradient
        colors={['#D9BC82', '#C9A96E', '#A67C3A']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

      {/* SVG K mark */}
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Vertical bar — draws top → bottom */}
        <AnimatedLine
          x1="30" y1="12" x2="30" y2="88"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${VBAR} ${VBAR}`}
          strokeDashoffset={vbar as any}
        />
        {/* Upper arm — extends centre → top-right */}
        <AnimatedLine
          x1="30" y1="50" x2="70" y2="12"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${ARM} ${ARM}`}
          strokeDashoffset={upper as any}
        />
        {/* Lower arm — extends centre → bottom-right */}
        <AnimatedLine
          x1="30" y1="50" x2="70" y2="88"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${ARM} ${ARM}`}
          strokeDashoffset={lower as any}
        />
      </Svg>

      {/* Diagonal shimmer sweep — clipped by parent overflow:hidden */}
      <RNAnimated.View
        style={{
          position: 'absolute',
          top: -10,
          left: 0,
          width: Math.round(size * 0.45),
          height: size + 20,
          backgroundColor: 'rgba(255,255,255,0.2)',
          opacity: shimOp,
          transform: [{ translateX: shimX }, { rotate: '16deg' }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    overflow: 'hidden',
    shadowColor: Colors.accent.primary,
    shadowOpacity: 0.45,
    elevation: 10,
  },
});
