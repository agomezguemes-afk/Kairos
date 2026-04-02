// KAIROS DESIGN SYSTEM — TOKENS

export const Colors = {
  background: {
    void: '#0A0A0F',
    surface: '#14141A',
    elevated: '#1E1E26',
    overlay: '#2A2A34',
  },
  accent: {
    primary: '#C9A96E',
    light: '#E8D5B7',
    muted: 'rgba(201, 169, 110, 0.15)',
    dim: 'rgba(201, 169, 110, 0.08)',
  },
  text: {
    primary: '#F0F0F0',
    secondary: '#A0A0A8',
    tertiary: '#666670',
    disabled: '#444450',
    inverse: '#0A0A0F',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.05)',
    light: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.20)',
  },
  semantic: {
    success: '#1DB88E',
    successMuted: 'rgba(29, 184, 142, 0.15)',
    error: '#E84545',
    errorMuted: 'rgba(232, 69, 69, 0.15)',
    warning: '#F0A030',
    warningMuted: 'rgba(240, 160, 48, 0.15)',
    info: '#5B8DEF',
    infoMuted: 'rgba(91, 141, 239, 0.15)',
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const Animation = {
  spring: {
    gentle: { damping: 20, stiffness: 150, mass: 1 },
    snappy: { damping: 15, stiffness: 250, mass: 0.8 },
    bouncy: { damping: 10, stiffness: 200, mass: 0.6 },
  },
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
  },
} as const;
