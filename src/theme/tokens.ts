// KAIROS DESIGN SYSTEM — TOKENS (Light theme: white + gold)

export const Colors = {
  background: {
    void: '#F7F7F5',       // main screen background (warm off-white)
    surface: '#FFFFFF',    // cards, sheets, modals
    elevated: '#F0EFEC',   // slightly raised surfaces
    overlay: '#E8E7E3',    // overlays, pressed states
    scrim: 'rgba(0, 0, 0, 0.35)',  // backdrop behind modals
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
  accent: {
    primary: '#C9A96E',
    light: '#E8D5B7',
    muted: 'rgba(201, 169, 110, 0.15)',
    dim: 'rgba(201, 169, 110, 0.08)',
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#6B6B6B',
    tertiary: '#9E9E9E',
    disabled: '#C4C4C4',
    inverse: '#FFFFFF',     // text on dark/colored backgrounds
    onAccent: '#FFFFFF',    // text on gold accent
  },
  border: {
    subtle: 'rgba(0, 0, 0, 0.05)',
    light: 'rgba(0, 0, 0, 0.08)',
    medium: 'rgba(0, 0, 0, 0.12)',
    strong: 'rgba(0, 0, 0, 0.20)',
  },
  semantic: {
    success: '#1AA870',
    successMuted: 'rgba(26, 168, 112, 0.12)',
    error: '#D94040',
    errorMuted: 'rgba(217, 64, 64, 0.12)',
    warning: '#E08C20',
    warningMuted: 'rgba(224, 140, 32, 0.12)',
    info: '#4A7DE8',
    infoMuted: 'rgba(74, 125, 232, 0.12)',
  },
} as const;

export const Typography = {
  size: {
    hero: 32,
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
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

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

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

export const Animation = {
  spring: {
    gentle: { damping: 20, stiffness: 150, mass: 1 },
    snappy: { damping: 15, stiffness: 250, mass: 0.8 },
    bouncy: { damping: 10, stiffness: 200, mass: 0.6 },
    ios: { damping: 18, stiffness: 300, mass: 0.7 },      // iOS-like responsive
    tabIcon: { damping: 12, stiffness: 400, mass: 0.5 },   // quick tab press
  },
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
  },
} as const;
