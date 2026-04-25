import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

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

function resolveMode(pref: ThemePreference, system: ColorSchemeName): ThemeMode {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useWorkoutStore((s) => s.themePreference);
  const setPreference = useWorkoutStore((s) => s.setThemePreference);

  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? 'light',
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'light');
    });
    return () => sub.remove();
  }, []);

  const mode = resolveMode(preference, systemScheme);
  const colors = useMemo(() => buildThemeColors(mode), [mode]);

  const toggleTheme = useCallback(() => {
    if (preference === 'system') setPreference(mode === 'dark' ? 'light' : 'dark');
    else if (preference === 'light') setPreference('dark');
    else setPreference('light');
  }, [preference, mode, setPreference]);

  const value: ThemeContextValue = useMemo(
    () => ({ mode, preference, colors, setPreference, toggleTheme }),
    [mode, preference, colors, setPreference, toggleTheme],
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
