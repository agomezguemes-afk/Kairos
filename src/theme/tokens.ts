// KAIROS DESIGN SYSTEM — TOKENS v3 (single source of truth)
// Spec: docs/superpowers/specs/2026-04-27-kairos-visual-refinement-design.md §3
// One palette, one type ramp, one motion vocabulary.
// Dark mode deferred — light is the only mode for now (§8).

import { Platform } from 'react-native';
import type { FontVariant } from 'react-native/Libraries/StyleSheet/StyleSheetTypes';
import { Fonts } from './fonts';

// ── Color ────────────────────────────────────────────────────────────────────

export const Colors = {
  // ── Material (Design v3 §3a) ──────────────────────────────────────────────
  // WHY: the canvas is warm paper and the cards are white — inverted from v2,
  // where both were #FFFFFF and a card could only exist by wearing a grey
  // border. Card = white on paper → it exists by MATERIAL contrast, no border.
  paper: {
    base: '#FBF9F5', // THE CANVAS. Every screen background.
    raised: '#FFFFFF', // THE CARDS. They lift off the paper.
    warm: '#F4EFE5', // editorial zones, quote blocks
    deep: '#EBE3D4', // celebration, PR, dense moments
    // WHY: translucent warm white for blurred chrome (tab capsule). Pure white
    // at 72% over a warm blur reads blue-ish; this is ink.inverse with alpha.
    veil: 'rgba(255,253,249,0.72)',
    // WHY: sheet backdrops. Pure black (rgba(0,0,0,0.35)) over warm paper reads
    // as a cold filter on the page; this is ink at the same alpha. Three weights
    // because the app already used three (0.18 / 0.32–0.38 / 0.5–0.72).
    scrimSoft: 'rgba(28,24,20,0.18)', // a hint of dim (inline overlays)
    scrim: 'rgba(28,24,20,0.35)', // standard sheet backdrop
    scrimDeep: 'rgba(28,24,20,0.62)', // full-screen takeovers, celebration
    grain: 0.035, // opacity of the tiled noise (≤0.04 — never eat legibility)
  },
  bg: {
    /** @deprecated alias of paper.base */
    void: '#FBF9F5',
    /** @deprecated alias of paper.raised */
    surface: '#FFFFFF',
    elevated: '#F3EFE8', // pressed states — warm, was cool #F2F0EC
    /** @deprecated alias of paper.warm */
    warm: '#F4EFE5',
    /** @deprecated alias of paper.deep */
    warm2: '#EBE3D4',
  },
  // WHY (Design v3 §3c): the old ramp was Tailwind's gray-500/gray-400 (#6B7280,
  // #9CA3AF) — cool greys (~220° hue) on a warm brand. This ramp is warm ink:
  // hue ~30°, saturation 3–8%. Every pair below is ≥4.5:1 on paper.base
  // (see src/theme/__tests__/contrast.test.ts — it's a gate, not a vibe).
  ink: {
    primary: '#241F1A', // headlines, body — 15.5:1 on paper
    secondary: '#4A4139', // emphasized secondary — 9.5:1
    tertiary: '#6E6357', // metadata — 5.6:1
    muted: '#736858', // labels, placeholders — 5.2:1 (doc's #7D7263 was 4.4 → failed)
    faint: '#A79C8D', // DECORATION ONLY (hairlines, dots). 2.6:1 — never text.
    inverse: '#FFFDF9', // warm white on ink/gold — never pure #FFFFFF
  },
  gold: {
    base: '#D4AF37', // signature accent — primary CTAs, indicators
    deep: '#7A6118', // gold-as-INK (eyebrows, chapter labels) — 5.6:1 on paper,
    // 5.2:1 on paper.warm. Was #8B6F1D (4.2:1 on warm → failed AA).
    light: '#EBDCAD', // gold tint, subtle accents
    glow: 'rgba(212,175,55,0.18)', // halos, ripples, pill backgrounds
  },
  // WHY (Design v3 §3f): "filetes, no bordes" — editorial rules BETWEEN things,
  // not perimeters AROUND them. Tinted with ink (36,31,26), never blue-black.
  hair: {
    subtle: 'rgba(36,31,26,0.06)', // section dividers
    base: 'rgba(36,31,26,0.10)', // rules, tracks, inputs
    strong: 'rgba(36,31,26,0.16)', // pressed borders, dividers on white
    gold: 'rgba(212,175,55,0.28)', // gold card borders on white (spec 0.2–0.4)
    goldStrong: 'rgba(212,175,55,0.40)', // active/focus gold borders
  },
  discipline: {
    strength: '#E84545',
    running: '#5B8DEF',
    calisthenics: '#1DB88E',
    mobility: '#8B5CF6',
    team_sport: '#F0A030',
    cycling: '#06B6D4',
    swimming: '#3B82F6',
    general: '#D4AF37',
  },
  // WHY (Design v2, pattern 5 "tarjetas tintadas sin borde"): soft fills — the
  // discipline hue at ~10% alpha — so a borderless card reads as "coloured" on
  // the white canvas without a border or shadow. Keys mirror `discipline` 1:1
  // so `Colors.tint[block.discipline]` always resolves. Never gold-as-accent:
  // gold stays reserved for Kai; here it is only the 'general' content tint.
  tint: {
    strength: 'rgba(232,69,69,0.10)',
    running: 'rgba(91,141,239,0.10)',
    calisthenics: 'rgba(29,184,142,0.10)',
    mobility: 'rgba(139,92,246,0.10)',
    team_sport: 'rgba(240,160,48,0.12)',
    cycling: 'rgba(6,182,212,0.10)',
    swimming: 'rgba(59,130,246,0.10)',
    general: 'rgba(212,175,55,0.10)',
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
  /** @deprecated Use Colors.paper.* */
  get background() {
    return {
      void: this.paper.base,
      surface: this.paper.raised,
      elevated: this.bg.elevated,
      overlay: this.bg.elevated,
      scrim: 'rgba(28,24,20,0.40)', // warm scrim — a cool scrim greys the paper
      gradientStart: this.paper.raised,
      gradientEnd: this.paper.warm,
    };
  },
  /** @deprecated Use Colors.ink.* */
  get text() {
    return {
      primary: this.ink.primary,
      secondary: this.ink.tertiary,
      tertiary: this.ink.tertiary,
      disabled: this.ink.faint, // was #C7C7CC (cool grey)
      inverse: this.ink.inverse,
      onAccent: this.ink.inverse,
    };
  },
  /** @deprecated Use Colors.hair.* */
  get border() {
    return {
      subtle: 'rgba(36,31,26,0.04)',
      light: 'rgba(36,31,26,0.07)',
      medium: 'rgba(36,31,26,0.11)',
      strong: 'rgba(36,31,26,0.18)',
      warm: '#EDE6DA', // was #EFECE8 (cool)
    };
  },
  /** @deprecated Use Colors.gold.* */
  get accent() {
    return {
      primary: this.gold.base,
      light: this.gold.light,
      muted: this.gold.glow,
      dim: 'rgba(212,175,55,0.08)',
      glow: 'rgba(212,175,55,0.35)',
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

// Brand families. With custom fonts, the WEIGHT lives in the family name (RN
// ignores fontWeight for custom faces), so each Type preset below picks an
// explicit weight family. `fontWeight` is kept on presets only as a hint for
// web / the pre-load system fallback — it's a no-op on native once fonts load.
export const FontFamily = {
  sans: Fonts.sansRegular, // Plus Jakarta Sans
  serif: Fonts.serifSemiBold, // Fraunces — signature editorial serif
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
} as const;

/**
 * Type presets — v4 (brand type identity).
 * Signature serif **Fraunces** is reserved for expressive moments: oversized
 * greetings (`heroDisplay`), large titles (`title`), the italic accent word
 * (`serifAccent`), and hero numerals (`numHero`). Everything structural runs in
 * **Plus Jakarta Sans**. Optical tracking tightens as size grows.
 */
export const Type = {
  // Oversized editorial greeting — Fraunces Black (opsz 144 / SOFT 100 / WONK 1),
  // the loudest brand voice. WHY 52 / -1.6 (Design v3 §3b): a display face wants
  // leading BELOW its natural line (1.23× for Fraunces) so lines lock into a
  // block of ink. Was 44/47/-1.2.
  //
  // WHY 50 and not the doc's 48: measured, not guessed. At 52pt Fraunces Black's
  // Á tops out at 48.8pt of ink above the baseline (upm 2000, Aacute yMax 1876).
  // A 48pt line box clips the accent — and "Álvaro" is the first word this app
  // ever prints. 50pt is the tightest leading (0.96×) that clears it.
  heroDisplay: {
    fontFamily: Fonts.serifBlack,
    fontSize: 52,
    lineHeight: 50,
    fontWeight: '900' as const,
    letterSpacing: -1.6,
  },
  // Editorial serif large-title — Fraunces SemiBold.
  title: {
    fontFamily: Fonts.serifSemiBold,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '600' as const,
    letterSpacing: -0.8,
  },
  titleSmall: {
    fontFamily: Fonts.serifSemiBold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
  },
  // Emphasized editorial word — Fraunces SemiBold *Italic*. Use sparingly for
  // the one word that carries the line (e.g. "tu *espacio*").
  // Dedicated italic TTF — no fontStyle (avoids synthetic double-skew on Android).
  serifAccent: {
    fontFamily: Fonts.serifSemiBoldItalic,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '600' as const,
    letterSpacing: -0.8,
  },

  // Sans — workhorse
  heading: {
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  subheading: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: { fontFamily: Fonts.sansRegular, fontSize: 15, lineHeight: 23, fontWeight: '400' as const },
  bodyEmph: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600' as const,
  },
  caption: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  micro: { fontFamily: Fonts.sansMedium, fontSize: 11, lineHeight: 14, fontWeight: '500' as const },

  // Editorial label — uppercase, tracked. The "CHAPTER 03" voice.
  // WHY 10/2.4 (Design v3 §3b): smaller + wider tracking reads as a printed
  // running head; 11/1.8 read as a UI label. Was 11/1.8.
  eyebrow: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
  },

  // Numerical — tabular for any UI showing weight/reps/time/distance.
  // numHero uses Fraunces (its numerals are a signature flourish); the rest run
  // in Jakarta for crisp, tabular legibility.
  // WHY: fontVariant cast to FontVariant[] (RN's mutable type) so StyleSheet.create accepts it.
  numHero: {
    fontFamily: Fonts.serifMedium,
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '500' as const,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'] as FontVariant[],
  },
  numLarge: {
    fontFamily: Fonts.sansBold,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'] as FontVariant[],
  },
  numMedium: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'] as FontVariant[],
  },
  numSmall: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums'] as FontVariant[],
  },

  // Letterpress — a light highlight UNDER the glyph so ink looks pressed into
  // the fibre. Spread onto headlines living on paper.warm / paper.deep only,
  // and only at ≥22pt (below that it smears). It's a textShadow: invisible to
  // VoiceOver, free on the GPU. (Design v3 §3f)
  letterpress: {
    textShadowColor: 'rgba(255,253,249,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
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
    // WHY (Design v3 §3d): air between NARRATIVE blocks is double the air
    // between cards — that's what separates a magazine from a settings screen.
    editorial: 40,
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

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#4A3B28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    shadowColor: '#4A3B28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  icon: {
    shadowColor: '#4A3B28',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  elevated: {
    shadowColor: '#4A3B28',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
  },
  modal: {
    shadowColor: '#4A3B28',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 14,
  },
  // WHY: gold-tinted shadow for V06 press depth bloom (spec §3.5)
  cardWarm: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 4,
  },
  // WHY: deeper neutral shadow for cards held down (spec §3.5)
  pressed: {
    shadowColor: '#4A3B28',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 8,
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
    // ── Material springs (Design v3 §3e) — mirror of springs.paper/ink/settle
    paper: { damping: 17, stiffness: 170, mass: 1.0 },
    ink: { damping: 26, stiffness: 210, mass: 0.9 },
    settle: { damping: 30, stiffness: 140, mass: 1.2 },
  },
  duration: {
    instant: 100,
    fast: 180,
    normal: 280,
    slow: 480,
  },
} as const;
