import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { StyleRegistry } from '@/components/StyleRegistry';
import './globals.css';

// Geist: an open-licence neutral grotesque with a clean numeric set; Geist Mono for code.
const sans = Geist({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'LoMu', template: '%s · LoMu' },
  description: 'LoMu: your music, everywhere.',
  applicationName: 'LoMu',
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/favicon-48.png', sizes: '48x48' }, { url: '/icon-192.png', sizes: '192x192' }], apple: '/apple-icon.png' },
  appleWebApp: { capable: true, title: 'LoMu', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e9e9ec' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} data-theme="dark" suppressHydrationWarning>
      <body>
        <StyleRegistry>
          <Providers>{children}</Providers>
        </StyleRegistry>
      </body>
    </html>
  );
}
