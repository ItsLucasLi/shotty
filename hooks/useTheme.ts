'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

const systemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const storedTheme = (): Theme | null => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    // Private mode, or storage blocked. Following the system is a fine default.
    return null;
  }
};

/**
 * Theme state: follow the system until the user says otherwise.
 *
 * The html[data-theme] attribute is present only for an explicit override, so
 * following the system is pure CSS and keeps working with JavaScript off. An
 * inline script in the document restores a stored override before first paint,
 * so there is no flash of the wrong theme; this hook keeps it in step after.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  // The static HTML cannot know the visitor's theme, so the switch renders
  // only once the client has resolved it. Avoids both a hydration mismatch and
  // a frame of the knob sitting on the wrong side.
  const [ready, setReady] = useState(false);
  const current = useRef<Theme>('light');

  useEffect(() => {
    const resolved = storedTheme() ?? systemTheme();
    current.current = resolved;
    setTheme(resolved);
    setReady(true);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (event: MediaQueryListEvent) => {
      // Only track the system while the user has not pinned a choice.
      if (storedTheme()) return;
      const next: Theme = event.matches ? 'dark' : 'light';
      current.current = next;
      setTheme(next);
    };

    media.addEventListener('change', onSystemChange);
    return () => media.removeEventListener('change', onSystemChange);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    if (storedTheme()) root.dataset.theme = theme;
    else delete root.dataset.theme;
  }, [theme, ready]);

  const toggle = useCallback(() => {
    const next: Theme = current.current === 'dark' ? 'light' : 'dark';
    try {
      // Landing back on what the system already wants hands control back to
      // it, so a later OS change is followed again without needing a third
      // control for "system".
      if (next === systemTheme()) localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice still applies for this session.
    }
    current.current = next;
    setTheme(next);
  }, []);

  return { theme, toggle, ready };
}
