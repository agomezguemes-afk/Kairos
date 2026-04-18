// KAIROS — Unified spring & timing presets
// Import from here for all animations to keep a cohesive feel.
// These mirror (and extend) the Animation object in tokens.ts.

import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';

// ======================== SPRING PRESETS ========================

export const springs = {
  /** Standard iOS-feeling spring — quick settle, no bounce. */
  ios: { damping: 18, stiffness: 300, mass: 0.7 } satisfies WithSpringConfig,

  /** Buttery drag spring — used for block dragging feedback. */
  drag: { damping: 14, stiffness: 220, mass: 0.65 } satisfies WithSpringConfig,

  /** Gentle deceleration — good for modals and overlays sliding in. */
  gentle: { damping: 22, stiffness: 160, mass: 1 } satisfies WithSpringConfig,

  /** Slight bounce — for FAB, badges, and celebration elements. */
  bouncy: { damping: 11, stiffness: 220, mass: 0.7 } satisfies WithSpringConfig,

  /** Quick tap feedback — for icon scale on press. */
  tap: { damping: 14, stiffness: 420, mass: 0.5 } satisfies WithSpringConfig,

  /** Tab bar icon bounce on switch. */
  tabIcon: { damping: 12, stiffness: 400, mass: 0.5 } satisfies WithSpringConfig,

  /** Celebration pop — used for badges and confetti trigger. */
  pop: { damping: 8, stiffness: 260, mass: 0.6 } satisfies WithSpringConfig,

  /** Slow, weighty settle — good for large modal entrances. */
  heavy: { damping: 24, stiffness: 120, mass: 1.2 } satisfies WithSpringConfig,
} as const;

// ======================== TIMING PRESETS ========================

export const timings = {
  instant:  { duration: 100 } satisfies WithTimingConfig,
  fast:     { duration: 180 } satisfies WithTimingConfig,
  normal:   { duration: 280 } satisfies WithTimingConfig,
  slow:     { duration: 480 } satisfies WithTimingConfig,
  verySlow: { duration: 700 } satisfies WithTimingConfig,

  fadeIn:   { duration: 320, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
  fadeOut:  { duration: 220, easing: Easing.in(Easing.cubic) } satisfies WithTimingConfig,
} as const;

// ======================== HAPTIC PRESETS ========================
// (Named references — actual calls use expo-haptics)
export const hapticEvents = {
  dragStart:      'Light',
  setComplete:    'Medium',
  blockComplete:  'Heavy',
  badgeUnlock:    'Success',
  tabSwitch:      'Light',
  deleteConfirm:  'Heavy',
} as const;
