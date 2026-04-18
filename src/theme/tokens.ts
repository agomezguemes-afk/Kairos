// KAIROS DESIGN SYSTEM — TOKENS (Light theme: white + gold)
// Premium minimalism: warm off-white canvas, charcoal text, gold accent.

export const Colors = {
  background: {
    void: '#F7F7F5',         // main screen background (warm off-white)
    surface: '#FFFFFF',       // cards, sheets, modals
    elevated: '#F2F0EC',      // slightly raised surfaces
    overlay: '#E9E7E2',       // overlays, pressed states
    scrim: 'rgba(0, 0, 0, 0.38)',
    // Subtle warm gradient helpers (use with expo-linear-gradient)
    gradientStart: '#FFFFFF',
    gradientEnd:   '#FFF8F0', // whisper of gold
  },
  discipline: {
    strength:   '#E84545',
    running:    '#5B8DEF',
    calisthenics:'#1DB88E',
    mobility:   '#8B5CF6',
    team_sport: '#F0A030',
    cycling:    '#06B6D4',
    swimming:   '#3B82F6',
    general:    '#C9A96E',
  },
  accent: {
    primary: '#C9A96E',             // signature gold
    light:   '#E8D5B7',             // light gold tint
    muted:   'rgba(201,169,110,0.18)',
    dim:     'rgba(201,169,110,0.08)',
    glow:    'rgba(201,169,110,0.35)',  // used for glow rings
  },
  text: {
    primary:   '#1C1C1E',   // deep charcoal (matches Apple HIG)
    secondary: '#636366',
    tertiary:  '#9B9B9E',
    disabled:  '#C7C7CC',
    inverse:   '#FFFFFF',
    onAccent:  '#FFFFFF',
  },
  border: {
    subtle:    'rgba(0,0,0,0.04)',
    light:     'rgba(0,0,0,0.07)',
    medium:    'rgba(0,0,0,0.11)',
    strong:    'rgba(0,0,0,0.18)',
    warm:      '#EFECE8',           // warm off-white card border (premium feel)
  },
  semantic: {
    success:       '#1AA870',
    successMuted:  'rgba(26,168,112,0.12)',
    error:         '#D94040',
    errorMuted:    'rgba(217,64,64,0.12)',
    warning:       '#E08C20',
    warningMuted:  'rgba(224,140,32,0.12)',
    info:          '#4A7DE8',
    infoMuted:     'rgba(74,125,232,0.12)',
  },
} as const;

// ── Typography ───────────────────────────────────────────────────────────────
// Body: system sans-serif (SF Pro / Roboto) — no extra import needed.
// Headings: slightly tighter tracking for a distinctive editorial feel.

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
  // Letter-spacing presets (em equivalent — use as `letterSpacing` in points)
  tracking: {
    tight:    -0.5,
    normal:    0,
    wide:      0.5,
    extraWide: 1.5,
    caps:      2,
  },
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
  xs:   6,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  full: 9999,
} as const;

// ── Shadows ──────────────────────────────────────────────────────────────────
// All shadows use warm-black to stay on-brand with the off-white palette.

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
