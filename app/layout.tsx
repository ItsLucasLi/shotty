import type { Metadata, Viewport } from 'next';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shotty — screenshot beautifier',
  description:
    'Add a background, padding, rounded corners and a shadow to a screenshot, then export a PNG. Runs entirely in your browser — images are never uploaded.',
  applicationName: 'Shotty',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#17161a' },
  ],
};

/**
 * Restores a pinned theme before the page paints.
 *
 * Only an explicit override is written to the attribute — with none stored,
 * the CSS media query follows the system on its own, so this is a no-op and
 * the app still themes correctly with JavaScript disabled.
 */
const restoreTheme = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* The id is load-bearing: React 19 drops an inline script without an
            identifying prop, which silently cost us the no-flash guarantee. */}
        <script id="shotty-theme-init" dangerouslySetInnerHTML={{ __html: restoreTheme }} />
        {children}
      </body>
    </html>
  );
}
