// KAIROS DESIGN SYSTEM — TOKENS v3 (single source of truth)
// Spec: docs/superpowers/specs/2026-04-27-kairos-visual-refinement-design.md §3
// One palette, one type ramp, one motion vocabulary.
// Dark mode deferred — light is the only mode for now (§8).

import { Platform } from 'react-native';
import type { FontVariant } from 'react-native/Libraries/StyleSheet/StyleSheetTypes';

// ── Color ────────────────────────────────────────────────────────────────────

export const Colors = {
  bg: {
    // v4 (2026-11-09): direction "D · Bloque" — bone ground, ink lines.
    void: '#F4F2EC', // primary screen background (bone)
    surface: '#FFFFFF', // cards, sheets, modals
    elevated: '#ECE9E1', // raised surfaces, pressed states
    warm: '#F7F1E3', // "premium" zones — hero cards, PR badges
    warm2: '#EFE4CC', // deeper warm — PR celebration, editorial blocks
  },
  ink: {
    primary: '#121211', // headlines, body
    secondary: '#2B2A27', // emphasized secondary
    tertiary: '#5D5A52', // metadata
    muted: '#8A867C', // labels, placeholders
    inverse: '#FFFFFF', // text on dark/gold surfaces
  },
  gold: {
    base: '#C9A96E', // signature accent — primary CTAs, indicators
    deep: '#8C6E2A', // gold-on-warm text (eyebrows, chapter labels)
    light: '#E8D5B7', // gold tint, subtle accents
    glow: 'rgba(201,169,110,0.18)', // halos, ripples, pill backgrounds
  },
  hair: {
    // Card borders are ink lines now (brutalist); dividers stay faint.
    subtle: 'rgba(18,18,17,0.12)', // section dividers
    base: 'rgba(18,18,17,0.72)', // card borders (default)
    strong: '#121211', // pressed borders, emphasized outlines
  },
  discipline: {
    strength: '#E84545',
    running: '#5B8DEF',
    calisthenics: '#1DB88E',
    mobility: '#8B5CF6',
    team_sport: '#F0A030',
    cycling: '#06B6D4',
    swimming: '#3B82F6',
    general: '#C9A96E',
  },
  semantic: {
    success: '#1AA870',
    error: '#D94040',
    warning: '#E08C20',
    info: '#4A7DE8',
    successMuted: 'rgba(26,168,112,0.10)',
    errorMuted: 'rgba(217,64,64,0.10)',
    warningMuted: 'rgba(224,140,32,0.10)',
    infoMuted: 'rgba(74,125,232,0.10)',
  },

  // ── Backwards-compat shims (removed after full migration) ─────────────────
  // WHY: keeps existing call sites compiling while screens migrate to new keys.
  /** @deprecated Use Colors.bg.void */
  get background() {
    return {
      void: this.bg.void,
      surface: this.bg.surface,
      elevated: this.bg.elevated,
      overlay: this.bg.elevated,
      scrim: 'rgba(0, 0, 0, 0.38)',
      gradientStart: '#FFFFFF',
      gradientEnd: '#FFF8F0',
    };
  },
  /** @deprecated Use Colors.ink.* */
  get text() {
    return {
      primary: this.ink.primary,
      secondary: this.ink.tertiary,
      tertiary: this.ink.tertiary,
      disabled: '#C7C7CC',
      inverse: this.ink.inverse,
      onAccent: this.ink.inverse,
    };
  },
  /** @deprecated Use Colors.hair.* */
  get border() {
    return {
      subtle: 'rgba(0,0,0,0.04)',
      light: 'rgba(0,0,0,0.07)',
      medium: 'rgba(0,0,0,0.11)',
      strong: 'rgba(0,0,0,0.18)',
      warm: '#EFECE8',
    };
  },
  /** @deprecated Use Colors.gold.* */
  get accent() {
    return {
      primary: this.gold.base,
      light: this.gold.light,
      muted: this.gold.glow,
      dim: 'rgba(201,169,110,0.08)',
      glow: 'rgba(201,169,110,0.35)',
    };
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
    surface: Colors.bg.surface,
    surfaceWarm: Colors.bg.warm,
    surfaceElevated: Colors.bg.elevated,
    text: {
      primary: Colors.ink.primary,
      secondary: Colors.ink.tertiary,
      muted: Colors.ink.muted,
    },
    border: Colors.hair.base,
    gold: { 300: Colors.gold.light, 500: Colors.gold.base, 700: Colors.gold.deep },
    success: Colors.semantic.success,
    warning: Colors.semantic.warning,
    danger: Colors.semantic.error,
    shadowOpacity: 0.08,
  };
}

// ── Typography ───────────────────────────────────────────────────────────────

// v4: Space Grotesk body, Anton display (in the old "serif" slot, which was
// already reserved for large titles and hero numerals), Space Mono labels.
// Faces are loaded in App.tsx; each name is one weight, so presets below
// keep fontWeight at '400' to stop web from synthesising a second bold.
export const FontFamily = {
  sans: 'SpaceGrotesk_500Medium',
  sansSemi: 'SpaceGrotesk_600SemiBold',
  sansBold: 'SpaceGrotesk_700Bold',
  serif: 'Anton_400Regular',
  mono: 'SpaceMono_400Regular_Italic',
  monoBold: 'SpaceMono_700Bold_Italic',
} as const;

// Display faces have no italic; web can slant per glyph, native stays
// upright here (screens on the Brut primitives get a skew instead).
const DISPLAY_SLANT = Platform.OS === 'web' ? ({ fontStyle: 'italic' } as const) : {};

/**
 * Type presets — v3.
 * Serif is reserved for exactly 4 places: splash wordmark, screen large-titles,
 * hero stat numerals, and editorial cards. Everywhere else: system sans.
 */
export const Type = {
  // Display (Anton) — large titles
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
    ...DISPLAY_SLANT,
  },
  titleSmall: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
    ...DISPLAY_SLANT,
  },

  // Space Grotesk — workhorse
  heading: {
    fontFamily: FontFamily.sansBold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '400' as const,
    letterSpacing: -0.3,
  },
  subheading: {
    fontFamily: FontFamily.sansSemi,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  body: { fontFamily: FontFamily.sans, fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyEmph: {
    fontFamily: FontFamily.sansSemi,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  caption: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  micro: { fontFamily: FontFamily.mono, fontSize: 11, lineHeight: 14, fontWeight: '400' as const },

  // Mono label — uppercase, tracked. The "01 · SEMANA" voice.
  eyebrow: {
    fontFamily: FontFamily.monoBold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },

  // Numerical — tabular for any UI showing weight/reps/time/distance
  // WHY: fontVariant cast to FontVariant[] (RN's mutable type) so StyleSheet.create accepts it.
  numHero: {
    fontFamily: FontFamily.serif,
    fontSize: 60,
    lineHeight: 64,
    fontWeight: '400' as const,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'] as FontVariant[],
    ...DISPLAY_SLANT,
  },
  numLarge: {
    fontFamily: FontFamily.serif,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'] as FontVariant[],
    ...DISPLAY_SLANT,
  },
  numMedium: {
    fontFamily: FontFamily.sansBold,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400' as const,
    fontVariant: ['tabular-nums'] as FontVariant[],
  },
  numSmall: {
    fontFamily: FontFamily.sansSemi,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400' as const,
    fontVariant: ['tabular-nums'] as FontVariant[],
  },
} as const;

// ── Typography (v1 — backwards-compat shim) ─────────────────────────────────
// WHY: many screens import Typography.size.*, Typography.weight.*, etc.
export const Typography = {
  size: {
    hero: 34,
    title: 28,
    heading: 22,
    subheading: 17,
    body: 15,
    caption: 13,
    micro: 11,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.45,
    relaxed: 1.65,
  },
  tracking: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    extraWide: 1.5,
    caps: 2,
  },
  // v2 presets — kept for backward compat
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  heading: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  mono: { fontSize: 16, fontWeight: '400' as const, fontFamily: 'monospace', lineHeight: 24 },
} as const;

// ── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  screen: {
    horizontal: 20,
    top: 60,
    bottom: 100,
  },
  gap: {
    cards: 10,
    sections: 24,
    inline: 8,
    sets: 4,
  },
} as const;

// ── Radii ────────────────────────────────────────────────────────────────────

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 22, // WHY: matches iOS sheet corner radius (spec §3.4)
  '3xl': 28, // WHY: tab-bar capsule (spec §4.1)
  pill: 99,
  full: 9999,
} as const;

// ── Shadows ──────────────────────────────────────────────────────────────────

// v4: hard offset shadows (no blur) — the brutalist depth cue. Android
// elevation can't draw these, so it gets none rather than a soft blur.
export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#121211',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#121211',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  icon: {
    shadowColor: '#121211',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  elevated: {
    shadowColor: '#121211',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  modal: {
    shadowColor: '#121211',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  cardWarm: {
    shadowColor: '#C9A96E',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  pressed: {
    shadowColor: '#121211',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

// ── Animation presets (kept for backward compat) ─────────────────────────────
// Prefer importing from src/theme/animations.ts for new code.

export const Animation = {
  spring: {
    gentle: { damping: 22, stiffness: 160, mass: 1 },
    snappy: { damping: 15, stiffness: 260, mass: 0.8 },
    bouncy: { damping: 11, stiffness: 220, mass: 0.7 },
    ios: { damping: 18, stiffness: 300, mass: 0.7 },
    tabIcon: { damping: 12, stiffness: 400, mass: 0.5 },
    drag: { damping: 14, stiffness: 220, mass: 0.65 },
  },
  duration: {
    instant: 100,
    fast: 180,
    normal: 280,
    slow: 480,
  },
} as const;

// ── Coach surfaces ───────────────────────────────────────────────────────────
// WHY: the adaptive coach needs a "performance" register — live sessions and
// suggestion reveals sit on a deep ink stage so numbers and the gold accent
// carry all the emphasis. Same gold, same ink family; just inverted.

export const Coach = {
  stage: '#0F0F11', // live session / reveal background
  stageRaised: '#1A1A1D', // cards on stage
  stageLine: 'rgba(255,255,255,0.08)',
  stageInk: '#F5F5F2',
  stageMuted: 'rgba(245,245,242,0.56)',
  stageFaint: 'rgba(245,245,242,0.28)',
  zone: ['#7C8B9A', '#3FB27F', '#E3B341', '#E8793A', '#E2483D'] as const,
  rarity: {
    common: { edge: 'rgba(245,245,242,0.18)', glow: 'rgba(245,245,242,0.06)', label: 'Ajuste' },
    rare: { edge: '#C9A96E', glow: 'rgba(201,169,110,0.22)', label: 'Mejora' },
    epic: { edge: '#E8D5B7', glow: 'rgba(232,213,183,0.32)', label: 'Desbloqueo' },
  },
  display: {
    fontFamily: 'System',
    fontSize: 44,
    lineHeight: 46,
    fontWeight: '800' as const,
    letterSpacing: -1.6,
  },
  displayNum: {
    fontFamily: 'System',
    fontSize: 72,
    lineHeight: 76,
    fontWeight: '800' as const,
    letterSpacing: -3,
    fontVariant: ['tabular-nums'] as FontVariant[],
  },
} as const;

// ── Brut — direction "D · Bloque" (2026-11-09) ─────────────────────────
// Neo-brutalist boxes (2px ink outline + hard offset shadow) with a tech
// layer (mono labels, dot grid). Type: Anton display, Space Grotesk body,
// Space Mono labels, all slanted. Gold stays a fill: as text on white it
// fails contrast, so text on gold is always ink.
export const Brut = {
  bg: '#F4F2EC',
  surface: '#FFFFFF',
  ink: '#121211',
  accent: '#C9A96E',
  accentSoft: '#EFE4CC',
  onAccent: '#121211',
  muted: '#5D5A52',
  dot: 'rgba(18,18,17,0.08)',
  night: {
    bg: '#0E0E0D',
    surface: '#1A1A18',
    ink: '#F2F0EA',
    muted: '#A9A59B',
    dot: 'rgba(242,240,234,0.06)',
  },
  // Softened 2026-11-09: thinner lines and shorter shadows keep the
  // brutalist read without shouting.
  border: 1.5,
  shadow: { sm: 2, md: 3 },
  radius: { sm: 12, md: 16, lg: 18, xl: 20 },
  font: {
    display: 'Anton_400Regular',
    body: 'SpaceGrotesk_500Medium',
    bodySemi: 'SpaceGrotesk_600SemiBold',
    bodyBold: 'SpaceGrotesk_700Bold',
    mono: 'SpaceMono_400Regular_Italic',
    monoBold: 'SpaceMono_700Bold_Italic',
  },
  /** Anton and Space Grotesk ship no italic; native gets a skew instead. */
  slantDeg: -8,
  motion: { press: 120, tab: 320, reveal: 340 },
} as const;
