/**
 * Theme constants shared by the client hook and the server-rendered layout.
 *
 * This deliberately lives outside hooks/useTheme.ts. That module is 'use
 * client', and a value imported from a client module into a server component
 * arrives as a client reference rather than the value — which silently
 * compiled the pre-paint script down to localStorage.getItem(undefined).
 */

export type Theme = 'light' | 'dark';

/** Only written once the user overrides the system; absent means "follow it". */
export const THEME_STORAGE_KEY = 'shotty-theme';
