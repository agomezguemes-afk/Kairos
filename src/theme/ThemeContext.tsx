// KAIROS — Theme Context v2
// Spec §3 (Phase 1): dark mode deferred — always resolves to light.
// Public interface (useTheme, useThemeColors) unchanged so no call site breaks.
// WHY: removes the three-palette fragmentation by locking to the v3 light palette.

import React, { createContext, useContext, useMemo, useCallback } from 'react';

import { buildThemeColors, type ThemeColors, type ThemeMode } from './tokens';
import { useWorkoutStore, type ThemePreference } from '../store/workoutStore';

interface ThemeContextValue {
  mode: ThemeMode;
  preference: ThemePreference;
  colors: ThemeColors;
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Light palette is the only palette for now.
const LIGHT_COLORS: ThemeColors = buildThemeColors('light');

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useWorkoutStore((s) => s.themePreference);
  const setPreference = useWorkoutStore((s) => s.setThemePreference);

  // themePreference is preserved in the store for future dark-mode
  // reintroduction, but always resolves to 'light' here (spec §8).
  const toggleTheme = useCallback(() => {
    // no-op for now; preference round-trips through the store for future use
    if (preference === 'light') setPreference('dark');
    else setPreference('light');
  }, [preference, setPreference]);

  const value: ThemeContextValue = useMemo(
    () => ({
      mode:       'light' as ThemeMode,
      preference,
      colors:     LIGHT_COLORS,
      setPreference,
      toggleTheme,
    }),
    [preference, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
