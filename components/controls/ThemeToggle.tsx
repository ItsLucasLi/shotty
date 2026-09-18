'use client';

import type { Theme } from '@/lib/theme';

/**
 * A two-position switch, built from the same parts as the segmented controls:
 * a recessed track with an inset knob. The knob carries the current theme's
 * glyph — a filled disc for light, a crescent for dark — which stays legible
 * at 10px where a rayed sun would turn to mush.
 */
export function ThemeToggle({
  theme,
  onToggle,
  ready,
}: {
  theme: Theme;
  onToggle: () => void;
  ready: boolean;
}) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={isDark ? 'Switch to light' : 'Switch to dark'}
      onClick={onToggle}
      // Holds its space before the client resolves the theme, so the header
      // does not shift when the switch appears.
      className={`h-6 w-11 shrink-0 rounded-lg border border-line bg-canvas p-[3px] transition-opacity ${
        ready ? 'opacity-100' : 'invisible'
      }`}
    >
      <span
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-md bg-ink transition-transform duration-150 ${
          isDark ? 'translate-x-[20px]' : 'translate-x-0'
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
          {isDark ? (
            // Crescent: a disc with a second disc bitten out of it.
            <path
              d="M8 1.6A6.4 6.4 0 1 0 14.4 8 5 5 0 0 1 8 1.6Z"
              fill="var(--color-canvas)"
            />
          ) : (
            <circle cx="8" cy="8" r="4.6" fill="var(--color-canvas)" />
          )}
        </svg>
      </span>
    </button>
  );
}
