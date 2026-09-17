import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shotty — screenshot beautifier',
  description:
    'Add a background, padding, rounded corners and a shadow to a screenshot, then export a PNG. Runs entirely in your browser — images are never uploaded.',
  applicationName: 'Shotty',
};

export const viewport: Viewport = {
  themeColor: '#faf9f7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
