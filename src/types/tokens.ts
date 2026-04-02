// ============================================================
// KAIROS DESIGN SYSTEM — TOKENS
// ============================================================
// Fuente única de verdad para toda la identidad visual.
// Importa desde aquí en vez de hardcodear colores o tamaños.
// ============================================================

// ======================== COLORES ========================

export const Colors = {
  // --- Fondos (de más oscuro a más claro) ---
  background: {
    void: '#0A0A0F',       // Fondo base de la app
    surface: '#14141A',    // Cards, contenedores principales
    elevated: '#1E1E26',   // Hover, active, cards internas
    overlay: '#2A2A34',    // Modals, dropdowns, tooltips
  },

  // --- Accent: Warm Gold (identidad Kairos) ---
  accent: {
    primary: '#C9A96E',    // Botones principales, iconos activos
    light: '#E8D5B7',      // Texto sobre fondos accent
    muted: 'rgba(201, 169, 110, 0.15)', // Fondos sutiles accent
    dim: 'rgba(201, 169, 110, 0.08)',   // Bordes, separadores accent
  },

  // --- Texto ---
  text: {
    primary: '#F0F0F0',    // Títulos, contenido principal
    secondary: '#A0A0A8',  // Subtítulos, labels
    tertiary: '#666670',   // Hints, placeholders, metadata
    disabled: '#444450',   // Estados deshabilitados
    inverse: '#0A0A0F',    // Texto sobre fondos claros
  },

  // --- Bordes ---
  border: {
    subtle: 'rgba(255, 255, 255, 0.05)',  // Separadores mínimos
    light: 'rgba(255, 255, 255, 0.08)',   // Bordes de cards
    medium: 'rgba(255, 255, 255, 0.12)',  // Bordes hover
    strong: 'rgba(255, 255, 255, 0.20)',  // Bordes activos/focus
  },

  // --- Semánticos ---
  semantic: {
    success: '#1DB88E',       // Completado, PR, progreso positivo
    successMuted: 'rgba(29, 184, 142, 0.15)',
    error: '#E84545',         // Alertas, eliminar, máxima intensidad
    errorMuted: 'rgba(232, 69, 69, 0.15)',
    warning: '#F0A030',       // Estancamiento, atención
    warningMuted: 'rgba(240, 160, 48, 0.15)',
    info: '#5B8DEF',          // Sugerencias IA, información
    infoMuted: 'rgba(91, 141, 239, 0.15)',
  },

  // --- Categorías de ejercicio (para iconos/badges) ---
  category: {
    chest: '#E84545',
    back: '#5B8DEF',
    shoulders: '#F0A030',
    biceps: '#1DB88E',
    triceps: '#C9A96E',
    legs: '#8B5CF6',
    core: '#EC4899',
    cardio: '#06B6D4',
  },
} as const;

// ======================== TIPOGRAFÍA ========================

export const Typography = {
  // Escala de tamaños
  size: {
    hero: 32,       // Números grandes (stats destacados)
    title: 28,      // Título de marca / pantalla principal
    heading: 22,    // Títulos de pantalla
    subheading: 17, // Títulos de card / sección
    body: 15,       // Contenido general
    caption: 13,    // Labels, metadata, botones
    micro: 11,      // Hints, timestamps, badges
  },

  // Pesos
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights (ratio sobre el tamaño)
  lineHeight: {
    tight: 1.2,     // Títulos
    normal: 1.4,    // Cuerpo
    relaxed: 1.6,   // Párrafos largos
  },
} as const;

// ======================== ESPACIADO ========================

export const Spacing = {
  micro: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,

  // Paddings específicos de layout
  screen: {
    horizontal: 20,  // Padding lateral de pantallas
    top: 60,          // Safe area top
    bottom: 100,      // Safe area bottom (tab bar)
  },

  // Gaps entre elementos
  gap: {
    cards: 10,        // Entre cards del mismo nivel
    sections: 24,     // Entre secciones
    inline: 8,        // Entre elementos en línea
    sets: 4,          // Entre filas de series
  },
} as const;

// ======================== RADIOS ========================

export const Radius = {
  xs: 6,       // Checkboxes, badges pequeños
  sm: 8,       // Inputs, botones compactos
  md: 12,      // Cards internas (ExerciseCard)
  lg: 16,      // Cards principales (WorkoutBlock)
  xl: 20,      // Contenedores de pantalla, modals
  full: 9999,  // Pills, avatares circulares
} as const;

// ======================== SOMBRAS ========================

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
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ======================== ANIMACIONES ========================

export const Animation = {
  // Spring configs para react-native-reanimated
  spring: {
    gentle: { damping: 20, stiffness: 150, mass: 1 },
    snappy: { damping: 15, stiffness: 250, mass: 0.8 },
    bouncy: { damping: 10, stiffness: 200, mass: 0.6 },
  },

  // Duraciones para Animated.timing
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
  },
} as const;

// ======================== BREAKPOINTS ========================
// Para cálculos responsivos de ancho de cards

export const Layout = {
  // Ancho mínimo de una ExerciseCard colapsada
  exerciseCardMinHeight: 56,
  // Altura de la fila de set
  setRowHeight: 36,
  // Tamaño del icono de ejercicio
  exerciseIconSize: 28,
  exerciseIconRadius: 7,
  // Tamaño del checkbox de set
  setCheckboxSize: 18,
  setCheckboxRadius: 5,
} as const;
