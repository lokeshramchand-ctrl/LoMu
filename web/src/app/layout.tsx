import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { StyleRegistry } from '@/components/StyleRegistry';
import './globals.css';

// Three voices: Instrument Serif for titles, Geist for the interface, Geist Mono for times and numbers.
const sans = Geist({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'LoMu', template: '%s · LoMu' },
  description: 'LoMu: a listening log for your music, on every device.',
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
    { media: '(prefers-color-scheme: light)', color: '#f6f1e4' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1814' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} data-theme="dark" suppressHydrationWarning>
      <body>
        <StyleRegistry>
          <Providers>{children}</Providers>
        </StyleRegistry>
      </body>
    </html>
  );
}
