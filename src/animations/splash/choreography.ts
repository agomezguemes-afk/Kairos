// src/animations/splash/choreography.ts
import { Easing } from 'react-native-reanimated';

/**
 * Single source of truth for splash animation timings, easings, and motion constants.
 * Tweaking the splash should never require touching anything else.
 */

// ── Easing primitives ────────────────────────────────────────────────────────
export const EASE = {
  primary:    Easing.bezier(0.25, 0.1, 0.15, 1.0),
  decelerate: Easing.out(Easing.cubic),
  accelerate: Easing.in(Easing.cubic),
  meditative: Easing.inOut(Easing.ease),
} as const;

export const SPRING = {
  block:   { stiffness: 120, damping: 14, mass: 1 },
  bounce:  { stiffness: 180, damping: 10, mass: 0.8 },
} as const;

// ── Full sequence (KairosBootSequence) — 7400ms total ───────────────────────
export const FULL = {
  total: 7400,

  origin:        { start: 0,    duration: 600,  pause: 100 },
  emission:      { start: 700,  duration: 800,  staggerMs: 80,  angles: [10, 135, 250], distance: 120, blockRotation: 18 },
  return:        { start: 1500, duration: 700 },
  cubeMorph:     { start: 2200, duration: 700,  pause: 100, rotation: 15 },
  division:      { start: 3000, duration: 1000, staggerMs: 120 },
  mutation:      { start: 4000, duration: 1200, staggerMs: 100 },
  finalState:    { start: 5200, duration: 1200 },
  reverse:       { start: 6400, duration: 1000, staggerMs: 60 },

  hapticBeats: [0, 2400, 5000] as const,  // origin, cube formation, wordmark complete
} as const;

// ── Condensed sequence (SplashCondensed) — 3100ms total ─────────────────────
export const CONDENSED = {
  total: 3100,

  origin:        { start: 0,    duration: 500 },
  compressedArc: { start: 500,  duration: 800,  staggerMs: 60 },
  mutation:      { start: 1300, duration: 1100, staggerMs: 80 },
  finalState:    { start: 2400, duration: 500 },
  exit:          { start: 2900, duration: 200 },

  hapticBeats: [0, 2200] as const,
} as const;

// ── Visual constants ────────────────────────────────────────────────────────
export const VISUAL = {
  sphereSize: 40,
  blockSize:  18,
  cubeSize:   56,

  glowMaxOpacity:    0.35,
  breathScaleDelta:  0.005,  // ±0.5% during static states
  breathDuration:    3000,

  wordmarkSpacing: 36,  // px between letter centers
  letterFontSize:  44,  // for KairosWordmark <Text>
} as const;

// ── Storage ─────────────────────────────────────────────────────────────────
export const STORAGE_KEY    = 'kairos_splash_boot_v1';
export const STORAGE_VERSION = 1;
