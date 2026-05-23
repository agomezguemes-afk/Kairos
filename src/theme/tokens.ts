// KAIROS DESIGN SYSTEM — TOKENS v3 (single source of truth)
// Spec: docs/superpowers/specs/2026-04-27-kairos-visual-refinement-design.md §3
// One palette, one type ramp, one motion vocabulary.
// Dark mode deferred — light is the only mode for now (§8).

import { Platform } from 'react-native';
import type { FontVariant } from 'react-native/Libraries/StyleSheet/StyleSheetTypes';

// ── Color ────────────────────────────────────────────────────────────────────

export const Colors = {
  bg: {
    void:     '#F7F7F5',  // primary screen background (warm off-white)
    surface:  '#FFFFFF',  // cards, sheets, modals
    elevated: '#F2F0EC',  // raised surfaces, pressed states
    warm:     '#FAF6EE',  // "premium" zones — hero cards, PR badges
    warm2:    '#F5EFE2',  // deeper warm — PR celebration, editorial blocks
  },
  ink: {
    primary:   '#1C1C1E',  // headlines, body (Apple HIG deep charcoal)
    secondary: '#3A3A3C',  // emphasized secondary
    tertiary:  '#636366',  // metadata
    muted:     '#9B9B9E',  // labels, placeholders
    inverse:   '#FFFFFF',  // text on dark/gold surfaces
  },
  gold: {
    base:  '#C9A96E',                    // signature accent — primary CTAs, indicators
    deep:  '#8C6E2A',                    // gold-on-warm text (eyebrows, chapter labels)
    light: '#E8D5B7',                    // gold tint, subtle accents
    glow:  'rgba(201,169,110,0.18)',     // halos, ripples, pill backgrounds
  },
  hair: {
    subtle: 'rgba(28,28,30,0.06)',   // section dividers
    base:   'rgba(28,28,30,0.08)',   // card borders (default)
    strong: 'rgba(28,28,30,0.14)',   // pressed borders, dividers in white
  },
  discipline: {
    strength:    '#E84545',
    running:     '#5B8DEF',
    calisthenics:'#1DB88E',
    mobility:    '#8B5CF6',
    team_sport:  '#F0A030',
    cycling:     '#06B6D4',
    swimming:    '#3B82F6',
    general:     '#C9A96E',
  },
  semantic: {
    success:       '#1AA870',
    error:         '#D94040',
    warning:       '#E08C20',
    info:          '#4A7DE8',
    successMuted:  'rgba(26,168,112,0.10)',
    errorMuted:    'rgba(217,64,64,0.10)',
    warningMuted:  'rgba(224,140,32,0.10)',
    infoMuted:     'rgba(74,125,232,0.10)',
  },

  // ── Backwards-compat shims (removed after full migration) ─────────────────
  // WHY: keeps existing call sites compiling while screens migrate to new keys.
  /** @deprecated Use Colors.bg.void */
  get background() {
    return {
      void:          this.bg.void,
      surface:       this.bg.surface,
      elevated:      this.bg.elevated,
      overlay:       this.bg.elevated,
      scrim:         'rgba(0, 0, 0, 0.38)',
      gradientStart: '#FFFFFF',
      gradientEnd:   '#FFF8F0',
    };
  },
  /** @deprecated Use Colors.ink.* */
  get text() {
    return {
      primary:   this.ink.primary,
      secondary: this.ink.tertiary,
      tertiary:  this.ink.tertiary,
      disabled:  '#C7C7CC',
      inverse:   this.ink.inverse,
      onAccent:  this.ink.inverse,
    };
  },
  /** @deprecated Use Colors.hair.* */
  get border() {
    return {
      subtle: 'rgba(0,0,0,0.04)',
      light:  'rgba(0,0,0,0.07)',
      medium: 'rgba(0,0,0,0.11)',
      strong: 'rgba(0,0,0,0.18)',
      warm:   '#EFECE8',
    };
  },
  /** @deprecated Use Colors.gold.* */
  get accent() {
    return {
      primary: this.gold.base,
      light:   this.gold.light,
      muted:   this.gold.glow,
      dim:     'rgba(201,169,110,0.08)',
      glow:    'rgba(201,169,110,0.35)',
    };
  },
  // v2 tokens — kept for call sites that haven't migrated yet
  /** @deprecated */
  gold_v2: { 300: '#E8D48B', 500: '#C9A96E', 700: '#8C6E2A' },
  /** @deprecated */
  success_v2: '#2D6A4F',
  /** @deprecated */
  warning_v2: '#E09F3E',
  /** @deprecated */
  danger: '#C1292E',
  /** @deprecated Use Colors.bg.surface / Colors.bg.warm */
  surface_v2: { light: '#FFFFFF', warm: '#F5F0E8', dark: '#1A1A2E' },
  /** @deprecated Use Colors.ink.* */
  text_v2: {
    primary:   { light: '#1C1C1E', dark: '#F5F0E8' },
    secondary: { light: '#6B7280', dark: '#9CA3AF' },
    muted:     { light: '#9CA3AF', dark: '#6B7280' },
  },
} as const;

export type ThemeMode = 'light' | 'dark';

// ThemeColors — flat light-only values returned by useTheme().colors.
// WHY: mirrors v2 ThemeColors shape so existing call sites (HomeScreen,
// ProgressScreen, etc.) keep compiling while we migrate screen-by-screen.
export interface ThemeColors {
  surface: string;
  surfaceWarm: string;
  surfaceElevated: string;
  text: { primary: string; secondary: string; muted: string };
  border: string;
  /** @deprecated Use Colors.gold.* directly */
  gold: { 300: string; 500: string; 700: string };
  success: string;
  warning: string;
  danger: string;
  shadowOpacity: number;
}

/** Always returns the light palette. Dark mode deferred per spec §8. */
export function buildThemeColors(_mode?: ThemeMode): ThemeColors {
  return {
    surface:         Colors.bg.surface,
    surfaceWarm:     Colors.bg.warm,
    surfaceElevated: Colors.bg.elevated,
    text: {
      primary:   Colors.ink.primary,
      secondary: Colors.ink.tertiary,
      muted:     Colors.ink.muted,
    },
    border:        Colors.hair.base,
    gold:          { 300: Colors.gold.light, 500: Colors.gold.base, 700: Colors.gold.deep },
    success:       Colors.semantic.success,
    warning:       Colors.semantic.warning,
    danger:        Colors.semantic.error,
    shadowOpacity: 0.08,
  };
}

// ── Typography ───────────────────────────────────────────────────────────────

export const FontFamily = {
  sans:  'System',
  serif: Platform.select({ ios: 'New York', android: 'serif', default: 'Georgia' }),
  mono:  Platform.select({ ios: 'Menlo', default: 'monospace' }),
} as const;

/**
 * Type presets — v3.
 * Serif is reserved for exactly 4 places: splash wordmark, screen large-titles,
 * hero stat numerals, and editorial cards. Everywhere else: system sans.
 */
export const Type = {
  // Editorial serif — reserved per spec §3.2
  title:      { fontFamily: FontFamily.serif, fontSize: 32, lineHeight: 36, fontWeight: '600' as const, letterSpacing: -0.6 },
  titleSmall: { fontFamily: FontFamily.serif, fontSize: 22, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.3 },

  // System sans — workhorse
  heading:    { fontFamily: FontFamily.sans, fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.2 },
  subheading: { fontFamily: FontFamily.sans, fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  body:       { fontFamily: FontFamily.sans, fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyEmph:   { fontFamily: FontFamily.sans, fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  caption:    { fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  micro:      { fontFamily: FontFamily.sans, fontSize: 11, lineHeight: 14, fontWeight: '500' as const },

  // Editorial label — uppercase, tracked. The "CHAPTER 03" voice.
  eyebrow:    { fontFamily: FontFamily.sans, fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 1.6, textTransform: 'uppercase' as const },

  // Numerical — tabular for any UI showing weight/reps/time/distance
  // WHY: fontVariant cast to FontVariant[] (RN's mutable type) so StyleSheet.create accepts it.
  numHero:   { fontFamily: FontFamily.serif, fontSize: 56, lineHeight: 60, fontWeight: '500' as const, letterSpacing: -2, fontVariant: ['tabular-nums'] as FontVariant[] },
  numLarge:  { fontFamily: FontFamily.sans,  fontSize: 28, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.5, fontVariant: ['tabular-nums'] as FontVariant[] },
  numMedium: { fontFamily: FontFamily.sans,  fontSize: 18, lineHeight: 22, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as FontVariant[] },
  numSmall:  { fontFamily: FontFamily.sans,  fontSize: 13, lineHeight: 16, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as FontVariant[] },
} as const;

// ── Typography (v1 — backwards-compat shim) ─────────────────────────────────
// WHY: many screens import Typography.size.*, Typography.weight.*, etc.
export const Typography = {
  size: {
    hero:       34,
    title:      28,
    heading:    22,
    subheading: 17,
    body:       15,
    caption:    13,
    micro:      11,
  },
  weight: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
    heavy:    '800' as const,
  },
  lineHeight: {
    tight:   1.2,
    normal:  1.45,
    relaxed: 1.65,
  },
  tracking: {
    tight:    -0.5,
    normal:    0,
    wide:      0.5,
    extraWide: 1.5,
    caps:      2,
  },
  // v2 presets — kept for backward compat
  display:   { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  heading:   { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  body:      { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  caption:   { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  mono:      { fontSize: 16, fontWeight: '400' as const, fontFamily: 'monospace', lineHeight: 24 },
} as const;

// ── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
  screen: {
    horizontal: 20,
    top:        60,
    bottom:     100,
  },
  gap: {
    cards:    10,
    sections: 24,
    inline:    8,
    sets:      4,
  },
} as const;

// ── Radii ────────────────────────────────────────────────────────────────────

export const Radius = {
  xs:    6,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 22,  // WHY: matches iOS sheet corner radius (spec §3.4)
  '3xl': 28,  // WHY: tab-bar capsule (spec §4.1)
  pill:  99,
  full:  9999,
} as const;

// ── Shadows ──────────────────────────────────────────────────────────────────

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  icon: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  elevated: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 8,
  },
  modal: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 14,
  },
  // WHY: gold-tinted shadow for V06 press depth bloom (spec §3.5)
  cardWarm: {
    shadowColor: '#C9A96E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 4,
  },
  // WHY: deeper neutral shadow for cards held down (spec §3.5)
  pressed: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;

// ── Animation presets (kept for backward compat) ─────────────────────────────
// Prefer importing from src/theme/animations.ts for new code.

export const Animation = {
  spring: {
    gentle:  { damping: 22,  stiffness: 160, mass: 1    },
    snappy:  { damping: 15,  stiffness: 260, mass: 0.8  },
    bouncy:  { damping: 11,  stiffness: 220, mass: 0.7  },
    ios:     { damping: 18,  stiffness: 300, mass: 0.7  },
    tabIcon: { damping: 12,  stiffness: 400, mass: 0.5  },
    drag:    { damping: 14,  stiffness: 220, mass: 0.65 },
  },
  duration: {
    instant: 100,
    fast:    180,
    normal:  280,
    slow:    480,
  },
} as const;
