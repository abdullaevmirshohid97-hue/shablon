'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const THEMES = ['ice', 'light', 'dark', 'edex'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = 'mubosher.theme';
const DEFAULT_THEME: Theme = 'light';

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Runs before first paint, inlined into <head>. Without it the page renders
 * one frame of the default (white) theme before React hydrates, which on a
 * dark theme is a full-screen flash — the one thing users notice immediately
 * and never forgive.
 *
 * The valid names are interpolated from THEMES rather than written out again:
 * this string used to list them by hand, so adding a theme meant remembering
 * to edit a script inside a template literal, and forgetting meant the new
 * theme flashed white on every load.
 */
export const themeBootstrapScript = `(function(){try{var v=${JSON.stringify(
  THEMES,
)};var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});document.documentElement.dataset.theme=v.indexOf(t)>-1?t:${JSON.stringify(
  DEFAULT_THEME,
)}}catch(e){}})()`;

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render agree on the default; the real value is
  // read from storage in the effect below. The bootstrap script has already
  // put the right palette on <html>, so nothing flashes in between.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) setThemeState(stored);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    if (!isTheme(next)) return;
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled: the choice just won't outlive the tab.
    }
  }, []);

  // Paper is always light. Rather than maintaining a second copy of the whole
  // palette inside `@media print`, the document is flipped to the light theme
  // for the duration of the print — which also covers Ctrl+P, not just our own
  // export buttons.
  useEffect(() => {
    const root = document.documentElement;
    const before = () => {
      root.dataset.theme = 'light';
    };
    const after = () => {
      root.dataset.theme = theme;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
