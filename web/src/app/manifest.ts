import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LoMu',
    short_name: 'LoMu',
    description: 'LoMu — your music, everywhere.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f7f6',
    theme_color: '#f7f7f6',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
