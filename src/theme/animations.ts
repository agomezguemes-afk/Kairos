// KAIROS — Unified spring & timing presets v2
// Spec: docs/superpowers/specs/2026-04-27-kairos-visual-refinement-design.md §3.6
// Import from here for all animations to keep a cohesive motion vocabulary.

import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';

// ======================== SPRING PRESETS ========================

export const springs = {
  // ── Existing (kept for backward compat) ──────────────────────────────────
  /** Standard iOS-feeling spring — quick settle, no bounce. */
  ios:     { damping: 18, stiffness: 300, mass: 0.7  } satisfies WithSpringConfig,
  /** Buttery drag spring — used for block dragging feedback. */
  drag:    { damping: 14, stiffness: 220, mass: 0.65 } satisfies WithSpringConfig,
  /** Gentle deceleration — good for modals and overlays sliding in. */
  gentle:  { damping: 22, stiffness: 160, mass: 1    } satisfies WithSpringConfig,
  /** Slight bounce — for FAB, badges, and celebration elements. */
  bouncy:  { damping: 11, stiffness: 220, mass: 0.7  } satisfies WithSpringConfig,
  /** Quick tap feedback — for icon scale on press. */
  tap:     { damping: 14, stiffness: 420, mass: 0.5  } satisfies WithSpringConfig,
  /** Tab bar icon bounce on switch. */
  tabIcon: { damping: 12, stiffness: 400, mass: 0.5  } satisfies WithSpringConfig,
  /** Celebration pop — used for badges and confetti trigger. */
  pop:     { damping: 8,  stiffness: 260, mass: 0.6  } satisfies WithSpringConfig,
  /** Slow, weighty settle — good for large modal entrances. */
  heavy:   { damping: 24, stiffness: 120, mass: 1.2  } satisfies WithSpringConfig,

  // ── Semantic presets (spec §3.6) ─────────────────────────────────────────
  // WHY: call sites read intent ("enter", "celebrate"), not numbers.
  /** Entering elements — slightly slower for a welcoming feel. */
  enter:     { damping: 18, stiffness: 220, mass: 0.8 } satisfies WithSpringConfig,
  /** Leaving elements — faster than enter (asymmetry rule). */
  exit:      { damping: 22, stiffness: 280, mass: 0.7 } satisfies WithSpringConfig,
  /** Tab pill / segment selector indicator — snappy, minimal overshoot. */
  indicator: { damping: 24, stiffness: 380, mass: 0.7 } satisfies WithSpringConfig,
  /** Card / button press depth. */
  press:     { damping: 16, stiffness: 360, mass: 0.6 } satisfies WithSpringConfig,
  /** Bottom sheet present. */
  sheet:     { damping: 26, stiffness: 220, mass: 1.0 } satisfies WithSpringConfig,
  /** PR cards, streak increment — celebratory overshoot. */
  celebrate: { damping: 9,  stiffness: 200, mass: 0.7 } satisfies WithSpringConfig,
} as const;

// ======================== TIMING PRESETS ========================

export const timings = {
  instant:  { duration: 100 } satisfies WithTimingConfig,
  fast:     { duration: 180 } satisfies WithTimingConfig,
  normal:   { duration: 280 } satisfies WithTimingConfig,
  slow:     { duration: 480 } satisfies WithTimingConfig,
  verySlow: { duration: 700 } satisfies WithTimingConfig,

  fadeIn:   { duration: 320, easing: Easing.out(Easing.cubic) }  satisfies WithTimingConfig,
  fadeOut:  { duration: 220, easing: Easing.in(Easing.cubic) }   satisfies WithTimingConfig,
} as const;

// ======================== EASING PRESETS ========================
// WHY: for Easing-based timings where springs aren't appropriate (spec §3.6).

export const easings = {
  /** Material 3 "emphasized" — used for large surface entries. */
  emphasized:  Easing.bezier(0.20, 0, 0, 1),
  /** Notion-style soft arrival — elements decelerating into position. */
  decelerate:  Easing.bezier(0.16, 1, 0.3, 1),
  /** Exits — elements accelerating away. */
  accelerate:  Easing.bezier(0.4, 0, 1, 1),
  /** Default — most standard transitions. */
  standard:    Easing.bezier(0.4, 0, 0.2, 1),
} as const;

// ======================== HAPTIC EVENTS ========================
// (Named references — actual calls use expo-haptics)
export const hapticEvents = {
  dragStart:      'Light',
  setComplete:    'Medium',
  blockComplete:  'Heavy',
  badgeUnlock:    'Success',
  tabSwitch:      'Light',
  deleteConfirm:  'Heavy',
  cardPress:      'Light',   // WHY: PressableCard pressIn (spec §4.2)
  sheetOpen:      'Light',   // WHY: bottom sheet open (spec §4.3)
} as const;

// ======================== DURATION GUIDELINES ========================
// WHY: asymmetry rule — entrances ~280ms, exits ~220ms (spec §7 point 4).
export const durations = {
  /** Micro interactions: icon scale, checkmark toggle. */
  micro:    100,
  /** Standard transitions: card enter/exit, most UI state changes. */
  standard: 280,
  /** Complex layout shifts: sheet present, list stagger total. */
  complex:  480,
  /** Exit animations — always shorter than enter (asymmetry). */
  exit:     220,
} as const;
